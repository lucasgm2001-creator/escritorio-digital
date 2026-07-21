-- 059 — Cobrança semanal explícita + upgrade atribuído.
-- Uma linha de client_payments passa a representar a situação da semana, sem perder o ledger legado:
-- somente paga/parcial entra na receita (anulado=false); somente paga libera a comissão.

alter table public.client_payments
  add column if not exists status text,
  add column if not exists due_on date,
  add column if not exists valor_previsto_usd numeric,
  add column if not exists valor_pago_usd numeric,
  add column if not exists observacao text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid;

alter table public.client_payments alter column paid_on drop not null;

update public.client_payments
set status = case when coalesce(anulado, false) then 'anulada' else 'paga' end,
    due_on = coalesce(due_on, paid_on),
    valor_previsto_usd = coalesce(valor_previsto_usd, valor_usd),
    valor_pago_usd = coalesce(valor_pago_usd, case when coalesce(anulado, false) then 0 else valor_usd end)
where status is null or due_on is null or valor_previsto_usd is null or valor_pago_usd is null;

alter table public.client_payments alter column status set default 'paga';
alter table public.client_payments alter column status set not null;
alter table public.client_payments drop constraint if exists client_payments_status_check;
alter table public.client_payments add constraint client_payments_status_check
  check (status in ('prevista','vencida','paga','nao_paga','parcial','isenta','anulada'));
alter table public.client_payments add constraint client_payments_valores_validos
  check (coalesce(valor_previsto_usd, 0) >= 0 and coalesce(valor_pago_usd, 0) >= 0) not valid;

create index if not exists idx_client_payments_status_due on public.client_payments(team_id, status, due_on);

alter table public.weekly_payments
  add column if not exists client_payment_id uuid references public.client_payments(id) on delete set null;
create unique index if not exists uq_weekly_payment_client_payment
  on public.weekly_payments(client_payment_id) where client_payment_id is not null;

-- Vincula comissões legadas à semana que as originou. Bônus de upgrade (deal concluído) fica fora.
update public.weekly_payments wp
set client_payment_id = cp.id
from public.deals d, public.client_payments cp
where wp.client_payment_id is null
  and wp.deal_id = d.id
  and d.status = 'em_andamento'
  and d.client_id = cp.client_id
  and wp.numero_semana = cp.numero_semana
  and coalesce(cp.anulado, false) = false
  and not exists (
    select 1 from public.weekly_payments x
    where x.client_payment_id = cp.id and x.id <> wp.id
  );

create table if not exists public.client_payment_events (
  id uuid primary key default gen_random_uuid(),
  client_payment_id uuid not null references public.client_payments(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  numero_semana integer not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid,
  team_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_payment_events_payment on public.client_payment_events(client_payment_id, created_at desc);
alter table public.client_payment_events enable row level security;
create policy client_payment_events_select on public.client_payment_events for select
  using (team_id in (select user_team_ids()));

-- Edita/cria uma semana e sincroniza receita + comissão numa única transação.
create or replace function public.save_client_week(
  p_client_id uuid,
  p_numero_semana integer,
  p_status text,
  p_due_on date,
  p_valor_previsto_usd numeric,
  p_valor_pago_usd numeric default 0,
  p_paid_on date default null,
  p_cotacao_usd_brl numeric default null,
  p_plano_id uuid default null,
  p_observacao text default null
) returns public.client_payments
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
  v_before jsonb;
  v_row public.client_payments;
  v_deal public.deals;
  v_wp_id uuid;
  v_is_revenue boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_numero_semana < 1 then raise exception 'numero de semana invalido'; end if;
  if p_status not in ('prevista','vencida','paga','nao_paga','parcial','isenta','anulada') then
    raise exception 'situacao invalida';
  end if;
  if coalesce(p_valor_previsto_usd, 0) < 0 or coalesce(p_valor_pago_usd, 0) < 0 then
    raise exception 'valor invalido';
  end if;
  if p_status in ('paga','parcial') and (p_paid_on is null or coalesce(p_valor_pago_usd, 0) <= 0) then
    raise exception 'informe data e valor recebido';
  end if;

  select team_id into v_team from public.clients where id = p_client_id and deleted_at is null;
  if v_team is null then raise exception 'cliente inexistente'; end if;
  if not public.user_is_team_admin(v_team) then raise exception 'sem permissao'; end if;

  select to_jsonb(cp) into v_before
  from public.client_payments cp
  where cp.client_id = p_client_id and cp.numero_semana = p_numero_semana
  for update;

  v_is_revenue := p_status in ('paga','parcial');
  insert into public.client_payments (
    client_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl, plano_id, team_id,
    anulado, anulado_em, anulado_motivo, status, due_on, valor_previsto_usd,
    valor_pago_usd, observacao, updated_at, updated_by
  ) values (
    p_client_id, p_numero_semana,
    case when v_is_revenue then p_valor_pago_usd else p_valor_previsto_usd end,
    case when v_is_revenue then p_paid_on else null end,
    coalesce(p_cotacao_usd_brl, 1), p_plano_id, v_team,
    not v_is_revenue,
    case when p_status = 'anulada' then now() else null end,
    case when p_status = 'anulada' then nullif(trim(p_observacao), '') else null end,
    p_status, p_due_on, p_valor_previsto_usd,
    case when v_is_revenue then p_valor_pago_usd else 0 end,
    nullif(trim(p_observacao), ''), now(), v_uid
  )
  on conflict (client_id, numero_semana) do update set
    valor_usd = excluded.valor_usd,
    paid_on = excluded.paid_on,
    cotacao_usd_brl = excluded.cotacao_usd_brl,
    plano_id = excluded.plano_id,
    anulado = excluded.anulado,
    anulado_em = excluded.anulado_em,
    anulado_motivo = excluded.anulado_motivo,
    status = excluded.status,
    due_on = excluded.due_on,
    valor_previsto_usd = excluded.valor_previsto_usd,
    valor_pago_usd = excluded.valor_pago_usd,
    observacao = excluded.observacao,
    updated_at = now(),
    updated_by = v_uid
  returning * into v_row;

  -- Parcial conta como receita recebida, mas a comissão só nasce quando a semana fica totalmente paga.
  if p_status <> 'paga' then
    delete from public.weekly_payments where client_payment_id = v_row.id;
  else
    select d.* into v_deal
    from public.deals d
    join public.sellers s on s.id = d.seller_id and coalesce(s.gera_comissao, true)
    where d.client_id = p_client_id and d.status = 'em_andamento'
      and p_numero_semana <= d.teto_semanas
    order by d.data_fechamento desc, d.created_at desc
    limit 1;

    if v_deal.id is not null then
      insert into public.weekly_payments (
        deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl, team_id, client_payment_id
      ) values (
        v_deal.id, p_numero_semana, v_deal.valor_por_semana_usd, p_paid_on,
        coalesce(p_cotacao_usd_brl, 1), v_team, v_row.id
      )
      on conflict (deal_id, numero_semana) do update set
        paid_on = excluded.paid_on,
        cotacao_usd_brl = excluded.cotacao_usd_brl,
        client_payment_id = excluded.client_payment_id
      returning id into v_wp_id;
    end if;
  end if;

  insert into public.client_payment_events (
    client_payment_id, client_id, numero_semana, action, before_data, after_data, changed_by, team_id
  ) values (
    v_row.id, p_client_id, p_numero_semana,
    case when v_before is null then 'created' else 'updated' end,
    v_before, to_jsonb(v_row), v_uid, v_team
  );
  return v_row;
end;
$$;
revoke execute on function public.save_client_week(uuid,integer,text,date,numeric,numeric,date,numeric,uuid,text) from public;
grant execute on function public.save_client_week(uuid,integer,text,date,numeric,numeric,date,numeric,uuid,text) to authenticated;

-- Compatibilidade segura para qualquer chamada legada de "anular": usa o vínculo exato da comissão,
-- sem procurar o deal mais recente (que pode ser um bônus de upgrade).
create or replace function public.void_client_week(p_client_id uuid, p_numero_semana integer, p_motivo text default null)
  returns void language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
  v_payment uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select team_id into v_team from public.clients where id = p_client_id and deleted_at is null;
  if v_team is null then raise exception 'cliente inexistente'; end if;
  if not public.user_is_team_admin(v_team) then raise exception 'sem permissao'; end if;
  select id into v_payment from public.client_payments
    where client_id = p_client_id and numero_semana = p_numero_semana for update;
  if v_payment is null then raise exception 'semana inexistente'; end if;
  delete from public.weekly_payments where client_payment_id = v_payment;
  update public.client_payments set
    anulado = true, anulado_em = now(), anulado_motivo = nullif(trim(p_motivo), ''),
    status = 'anulada', valor_pago_usd = 0, paid_on = null,
    observacao = coalesce(nullif(trim(p_motivo), ''), observacao), updated_at = now(), updated_by = v_uid
  where id = v_payment;
end;
$$;
revoke execute on function public.void_client_week(uuid,integer,text) from public;
grant execute on function public.void_client_week(uuid,integer,text) to authenticated;

-- Metadados que tornam o bônus rastreável e reversível.
alter table public.plan_changes
  add column if not exists bonus_deal_id uuid references public.deals(id) on delete set null,
  add column if not exists bonus_payment_id uuid references public.weekly_payments(id) on delete set null,
  add column if not exists effective_week integer,
  add column if not exists observacao text,
  add column if not exists changed_by uuid;

create unique index if not exists uq_plan_change_same_event
  on public.plan_changes(client_id, new_plan_id, changed_at);

create or replace function public.register_plan_upgrade_v2(
  p_client_id uuid,
  p_new_plan_id uuid,
  p_changed_at date,
  p_seller_id uuid default null,
  p_bonus_override_usd numeric default null,
  p_effective_week integer default null,
  p_cotacao_usd_brl numeric default null,
  p_observacao text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cli public.clients;
  v_old public.plans;
  v_new public.plans;
  v_seller uuid := p_seller_id;
  v_team uuid;
  v_old_monthly numeric;
  v_new_monthly numeric;
  v_delta numeric;
  v_bonus numeric := 0;
  v_cfg public.collaborator_compensation_settings;
  v_bonus_deal uuid;
  v_bonus_payment uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_cli from public.clients where id = p_client_id and deleted_at is null for update;
  if v_cli.id is null then raise exception 'cliente inexistente'; end if;
  v_team := v_cli.team_id;
  if not public.user_is_team_admin(v_team) then raise exception 'sem permissao'; end if;
  if v_cli.status <> 'ativo' then raise exception 'cliente inativo'; end if;

  select * into v_new from public.plans where id = p_new_plan_id and ativo = true;
  if v_new.id is null then raise exception 'plano invalido'; end if;
  if v_cli.plano_id is not null then select * into v_old from public.plans where id = v_cli.plano_id; end if;
  v_old_monthly := coalesce(v_old.valor_mensal, v_old.valor_semanal * 4, v_cli.plan_weekly * 4, 0);
  v_new_monthly := coalesce(v_new.valor_mensal, v_new.valor_semanal * 4);
  v_delta := round((v_new_monthly - v_old_monthly)::numeric, 2);
  if v_delta <= 0 then raise exception 'o novo plano precisa ser maior'; end if;

  -- Sem escolha explícita, Lucas é o responsável padrão do upgrade.
  if v_seller is null then
    select id into v_seller from public.sellers
    where team_id = v_team and status = 'ativo' and lower(trim(name)) = 'lucas'
    order by created_at limit 1;
  end if;
  if v_seller is null then raise exception 'selecione o vendedor do upgrade'; end if;
  if not exists (select 1 from public.sellers where id = v_seller and team_id = v_team and status = 'ativo') then
    raise exception 'vendedor invalido';
  end if;

  if p_bonus_override_usd is not null then
    if p_bonus_override_usd < 0 then raise exception 'bonus invalido'; end if;
    v_bonus := round(p_bonus_override_usd, 2);
  else
    select * into v_cfg from public.collaborator_compensation_settings
    where seller_id = v_seller and effective_from <= p_changed_at
    order by effective_from desc limit 1;
    if coalesce(v_cfg.upgrade_commission_enabled, false) then
      v_bonus := case when v_cfg.upgrade_commission_type = 'fixed'
        then round(v_cfg.upgrade_commission_value, 2)
        else round((case when v_cfg.upgrade_commission_base = 'full_value' then v_new_monthly else v_delta end)
          * v_cfg.upgrade_commission_value / 100, 2) end;
    end if;
  end if;

  if v_bonus > 0 then
    insert into public.deals (
      seller_id, client_id, client_name, valor_total_usd, teto_semanas, valor_por_semana_usd,
      comissao_percentual, status, data_fechamento, team_id
    ) values (
      v_seller, p_client_id, v_cli.name || ' (bônus de upgrade)', v_bonus, 1, v_bonus,
      null, 'concluido', p_changed_at, v_team
    ) returning id into v_bonus_deal;
    insert into public.weekly_payments (
      deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl, team_id
    ) values (
      v_bonus_deal, 1, v_bonus, p_changed_at, coalesce(p_cotacao_usd_brl, 1), v_team
    ) returning id into v_bonus_payment;
  end if;

  insert into public.plan_changes (
    client_id, seller_id, old_plan_id, new_plan_id, old_valor_semanal, new_valor_semanal,
    delta_mensal_usd, bonus_usd, changed_at, team_id, bonus_deal_id, bonus_payment_id,
    effective_week, observacao, changed_by
  ) values (
    p_client_id, v_seller, v_cli.plano_id, p_new_plan_id, coalesce(v_old.valor_semanal, v_cli.plan_weekly),
    v_new.valor_semanal, v_delta, v_bonus, p_changed_at, v_team, v_bonus_deal, v_bonus_payment,
    p_effective_week, nullif(trim(p_observacao), ''), v_uid
  );

  update public.clients set plano_id = p_new_plan_id, plan_weekly = v_new.valor_semanal where id = p_client_id;
  return jsonb_build_object('bonus', v_bonus, 'deltaMensal', v_delta, 'sellerId', v_seller);
exception when unique_violation then
  raise exception 'este upgrade ja foi registrado';
end;
$$;
revoke execute on function public.register_plan_upgrade_v2(uuid,uuid,date,uuid,numeric,integer,numeric,text) from public;
grant execute on function public.register_plan_upgrade_v2(uuid,uuid,date,uuid,numeric,integer,numeric,text) to authenticated;
