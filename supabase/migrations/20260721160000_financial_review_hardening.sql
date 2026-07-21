-- 20260721160000 — Hardening pós code review do financeiro.
-- Fecha escritas diretas, valida pagamento integral, versiona a classificação dos lançamentos
-- e corrige sincronização/centavos das comissões parceladas de upgrade.

-- ── 1. Classificação explícita dos contratos de comissão ───────────────────────
alter table public.deals add column if not exists kind text not null default 'sale';
alter table public.deals drop constraint if exists deals_kind_check;
alter table public.deals add constraint deals_kind_check check (kind in ('sale', 'upgrade', 'renewal'));

update public.deals d set kind = 'upgrade'
where exists (select 1 from public.plan_changes pc where pc.bonus_deal_id = d.id);
update public.deals d set kind = 'renewal'
where exists (select 1 from public.contract_renewals cr where cr.bonus_deal_id = d.id);

update public.collaborator_compensation_settings cfg
set renewal_bonus_enabled=false,upgrade_commission_enabled=false,updated_at=now()
from public.sellers s where s.id=cfg.seller_id and not coalesce(s.gera_comissao,true);

alter table public.plan_changes
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists void_reason text;
drop index if exists public.uq_plan_change_same_event;
create unique index uq_plan_change_same_event on public.plan_changes(client_id,new_plan_id,changed_at)
  where voided_at is null;

-- ── 2. RLS: leitura no escopo correto; dinheiro só pode ser escrito por admin ─
-- Remove também as policies históricas de 029, para que um banco recriado do zero
-- não mantenha uma policy permissiva em paralelo (policies são combinadas com OR).
drop policy if exists "Auth le client_payments" on public.client_payments;
drop policy if exists "Auth gere client_payments" on public.client_payments;
drop policy if exists team_scope on public.client_payments;
drop policy if exists client_payments_select on public.client_payments;
drop policy if exists client_payments_insert on public.client_payments;
drop policy if exists client_payments_update on public.client_payments;
drop policy if exists client_payments_delete on public.client_payments;
create policy client_payments_select on public.client_payments for select
  using (team_id in (select user_team_ids()) and deleted_at is null);
create policy client_payments_insert on public.client_payments for insert
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null);
create policy client_payments_update on public.client_payments for update
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null)
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null);
create policy client_payments_delete on public.client_payments for delete
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id));

drop policy if exists deals_insert on public.deals;
drop policy if exists deals_update on public.deals;
drop policy if exists deals_delete on public.deals;
drop policy if exists "Auth lê deals" on public.deals;
drop policy if exists "Auth insere deals" on public.deals;
drop policy if exists "Auth atualiza deals" on public.deals;
drop policy if exists "Auth deleta deals" on public.deals;
create policy deals_insert on public.deals for insert
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null);
create policy deals_update on public.deals for update
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null)
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null);
create policy deals_delete on public.deals for delete
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id));

drop policy if exists seller_salaries_insert on public.seller_salaries;
drop policy if exists seller_salaries_update on public.seller_salaries;
drop policy if exists seller_salaries_delete on public.seller_salaries;
drop policy if exists "Auth lê seller_salaries" on public.seller_salaries;
drop policy if exists "Auth insere seller_salaries" on public.seller_salaries;
drop policy if exists "Auth atualiza seller_salaries" on public.seller_salaries;
drop policy if exists "Auth deleta seller_salaries" on public.seller_salaries;
create policy seller_salaries_insert on public.seller_salaries for insert
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id));
create policy seller_salaries_update on public.seller_salaries for update
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id))
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id));
create policy seller_salaries_delete on public.seller_salaries for delete
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id));

drop policy if exists meetings_insert on public.meetings;
drop policy if exists meetings_update on public.meetings;
drop policy if exists meetings_delete on public.meetings;
drop policy if exists "Auth lê meetings" on public.meetings;
drop policy if exists "Auth insere meetings" on public.meetings;
drop policy if exists "Auth atualiza meetings" on public.meetings;
drop policy if exists "Auth deleta meetings" on public.meetings;
create policy meetings_insert on public.meetings for insert
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null);
create policy meetings_update on public.meetings for update
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null)
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null);
create policy meetings_delete on public.meetings for delete
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id));

drop policy if exists weekly_payments_insert on public.weekly_payments;
drop policy if exists weekly_payments_update on public.weekly_payments;
drop policy if exists weekly_payments_delete on public.weekly_payments;
drop policy if exists "Auth lê weekly_payments" on public.weekly_payments;
drop policy if exists "Auth insere weekly_payments" on public.weekly_payments;
drop policy if exists "Auth atualiza weekly_payments" on public.weekly_payments;
drop policy if exists "Auth deleta weekly_payments" on public.weekly_payments;
create policy weekly_payments_insert on public.weekly_payments for insert
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null);
create policy weekly_payments_update on public.weekly_payments for update
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null)
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id) and deleted_at is null);
create policy weekly_payments_delete on public.weekly_payments for delete
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id));

drop policy if exists plan_changes_insert on public.plan_changes;
drop policy if exists plan_changes_update on public.plan_changes;
drop policy if exists plan_changes_delete on public.plan_changes;
create policy plan_changes_insert on public.plan_changes for insert
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id));
create policy plan_changes_update on public.plan_changes for update
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id))
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id));
create policy plan_changes_delete on public.plan_changes for delete
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id));

drop policy if exists "Auth le plans" on public.plans;
drop policy if exists "Auth gere plans" on public.plans;
drop policy if exists plans_select on public.plans;
drop policy if exists plans_write on public.plans;
create policy plans_select on public.plans for select using (team_id in (select user_team_ids()));
create policy plans_write on public.plans for all
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id))
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id));

drop policy if exists "Auth lê fx_config" on public.fx_config;
drop policy if exists "Auth insere fx_config" on public.fx_config;
drop policy if exists "Auth atualiza fx_config" on public.fx_config;
drop policy if exists fx_config_select on public.fx_config;
drop policy if exists fx_config_write on public.fx_config;
create policy fx_config_select on public.fx_config for select using (team_id in (select user_team_ids()));
create policy fx_config_write on public.fx_config for all
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id))
  with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id));

-- Mesmo que alguém tente atualizar a tabela clients diretamente, campos que alteram cobrança,
-- recorrência ou beneficiário só passam para admin. Service-role continua disponível aos fluxos
-- de servidor já autorizados e com ownership verificado.
create or replace function public.protect_client_financial_fields()
returns trigger language plpgsql set search_path=public as $$
begin
  if auth.role()='authenticated' and not public.user_is_team_admin(old.team_id) and (
    old.plano_id is distinct from new.plano_id or old.plan_weekly is distinct from new.plan_weekly
    or old.billing_anchor_date is distinct from new.billing_anchor_date
    or old.dia_pagamento_semana is distinct from new.dia_pagamento_semana
    or old.assigned_to is distinct from new.assigned_to or old.assigned_name is distinct from new.assigned_name
  ) then raise exception 'campos financeiros do cliente exigem administrador'; end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_client_financial_fields on public.clients;
create trigger trg_protect_client_financial_fields before update of plano_id,plan_weekly,billing_anchor_date,
  dia_pagamento_semana,assigned_to,assigned_name on public.clients
for each row execute function public.protect_client_financial_fields();

-- ── 3. Invariantes de status/valor ────────────────────────────────────────────
alter table public.client_payments drop constraint if exists client_payments_status_amount_check;
alter table public.client_payments add constraint client_payments_status_amount_check check (
  (status = 'paga' and paid_on is not null and valor_pago_usd > 0 and valor_pago_usd >= valor_previsto_usd)
  or (status = 'parcial' and paid_on is not null and valor_pago_usd > 0 and valor_pago_usd < valor_previsto_usd)
  or (status not in ('paga', 'parcial') and coalesce(valor_pago_usd, 0) = 0 and paid_on is null)
) not valid;

create or replace function public.save_client_week(
  p_client_id uuid, p_numero_semana integer, p_status text, p_due_on date,
  p_valor_previsto_usd numeric, p_valor_pago_usd numeric default 0,
  p_paid_on date default null, p_cotacao_usd_brl numeric default null,
  p_plano_id uuid default null, p_observacao text default null
) returns public.client_payments
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
  v_before jsonb;
  v_row public.client_payments;
  v_deal public.deals;
  v_is_revenue boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_numero_semana < 1 then raise exception 'numero de semana invalido'; end if;
  if p_status not in ('prevista','vencida','paga','nao_paga','parcial','isenta','anulada') then raise exception 'situacao invalida'; end if;
  if coalesce(p_valor_previsto_usd, 0) < 0 or coalesce(p_valor_pago_usd, 0) < 0 then raise exception 'valor invalido'; end if;
  if p_status = 'paga' and (p_paid_on is null or p_valor_pago_usd < p_valor_previsto_usd or p_valor_pago_usd <= 0) then
    raise exception 'pagamento integral exige data e valor recebido igual ou superior ao previsto';
  end if;
  if p_status = 'parcial' and (p_paid_on is null or p_valor_pago_usd <= 0 or p_valor_pago_usd >= p_valor_previsto_usd) then
    raise exception 'pagamento parcial exige valor maior que zero e menor que o previsto';
  end if;

  select team_id into v_team from public.clients where id = p_client_id and deleted_at is null;
  if v_team is null then raise exception 'cliente inexistente'; end if;
  if not public.user_is_team_admin(v_team) then raise exception 'sem permissao'; end if;

  select to_jsonb(cp) into v_before from public.client_payments cp
  where cp.client_id = p_client_id and cp.numero_semana = p_numero_semana for update;

  v_is_revenue := p_status in ('paga','parcial');
  insert into public.client_payments (
    client_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl, plano_id, team_id,
    anulado, anulado_em, anulado_motivo, status, due_on, valor_previsto_usd,
    valor_pago_usd, observacao, updated_at, updated_by
  ) values (
    p_client_id, p_numero_semana, case when v_is_revenue then p_valor_pago_usd else p_valor_previsto_usd end,
    case when v_is_revenue then p_paid_on else null end, coalesce(p_cotacao_usd_brl, 1), p_plano_id, v_team,
    not v_is_revenue, case when p_status = 'anulada' then now() else null end,
    case when p_status = 'anulada' then nullif(trim(p_observacao), '') else null end,
    p_status, p_due_on, p_valor_previsto_usd, case when v_is_revenue then p_valor_pago_usd else 0 end,
    nullif(trim(p_observacao), ''), now(), v_uid
  ) on conflict (client_id, numero_semana) do update set
    valor_usd=excluded.valor_usd, paid_on=excluded.paid_on, cotacao_usd_brl=excluded.cotacao_usd_brl,
    plano_id=excluded.plano_id, anulado=excluded.anulado, anulado_em=excluded.anulado_em,
    anulado_motivo=excluded.anulado_motivo, status=excluded.status, due_on=excluded.due_on,
    valor_previsto_usd=excluded.valor_previsto_usd, valor_pago_usd=excluded.valor_pago_usd,
    observacao=excluded.observacao, updated_at=now(), updated_by=v_uid
  returning * into v_row;

  if p_status <> 'paga' then
    delete from public.weekly_payments where client_payment_id = v_row.id;
  else
    select d.* into v_deal from public.deals d
    join public.sellers s on s.id=d.seller_id and coalesce(s.gera_comissao,true)
    where d.client_id=p_client_id and d.status='em_andamento' and d.kind='sale'
      and p_numero_semana <= d.teto_semanas
    order by d.data_fechamento desc, d.created_at desc limit 1;
    if v_deal.id is not null then
      insert into public.weekly_payments (deal_id,numero_semana,valor_usd,paid_on,cotacao_usd_brl,team_id,client_payment_id)
      values (v_deal.id,p_numero_semana,v_deal.valor_por_semana_usd,p_paid_on,coalesce(p_cotacao_usd_brl,1),v_team,v_row.id)
      on conflict (deal_id,numero_semana) do update set paid_on=excluded.paid_on,
        cotacao_usd_brl=excluded.cotacao_usd_brl,client_payment_id=excluded.client_payment_id;
    end if;
  end if;

  insert into public.client_payment_events (client_payment_id,client_id,numero_semana,action,before_data,after_data,changed_by,team_id)
  values (v_row.id,p_client_id,p_numero_semana,case when v_before is null then 'created' else 'updated' end,
    v_before,to_jsonb(v_row),v_uid,v_team);
  return v_row;
end;
$$;

-- ── 4. Upgrade exato, retroativo e consistente com semanas agendadas ─────────
drop function if exists public.register_plan_upgrade_v2(uuid,uuid,date,uuid,numeric,integer,numeric,text);
create function public.register_plan_upgrade_v2(
  p_client_id uuid, p_new_plan_id uuid, p_changed_at date,
  p_seller_id uuid default null, p_effective_week integer default null,
  p_observacao text default null
) returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_uid uuid:=auth.uid(); v_cli public.clients; v_old public.plans; v_new public.plans;
  v_seller uuid:=p_seller_id; v_team uuid; v_old_monthly numeric; v_new_monthly numeric;
  v_delta numeric; v_bonus numeric:=0; v_weekly_bonus numeric:=0; v_effective_week integer;
  v_enabled boolean:=false; v_bonus_deal uuid; v_paid record;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_cli from public.clients where id=p_client_id and deleted_at is null for update;
  if v_cli.id is null then raise exception 'cliente inexistente'; end if;
  v_team:=v_cli.team_id;
  if not public.user_is_team_admin(v_team) then raise exception 'sem permissao'; end if;
  if v_cli.status <> 'ativo' then raise exception 'cliente inativo'; end if;
  select * into v_new from public.plans where id=p_new_plan_id and ativo=true;
  if v_new.id is null then raise exception 'plano invalido'; end if;
  if v_cli.plano_id is not null then select * into v_old from public.plans where id=v_cli.plano_id; end if;
  v_old_monthly:=coalesce(v_old.valor_mensal,v_old.valor_semanal*4,v_cli.plan_weekly*4,0);
  v_new_monthly:=coalesce(v_new.valor_mensal,v_new.valor_semanal*4);
  v_delta:=round((v_new_monthly-v_old_monthly)::numeric,2);
  if v_delta <= 0 then raise exception 'o novo plano precisa ser maior'; end if;
  if v_seller is null then
    select id into v_seller from public.sellers where team_id=v_team and status='ativo'
      and lower(trim(name))='lucas' and coalesce(gera_comissao,true) order by created_at limit 1;
  end if;
  if v_seller is null then raise exception 'selecione o vendedor do upgrade'; end if;
  if not exists(select 1 from public.sellers where id=v_seller and team_id=v_team and status='ativo' and coalesce(gera_comissao,true)) then
    raise exception 'vendedor sem perfil de comissao';
  end if;
  select coalesce(cfg.upgrade_commission_enabled,false) into v_enabled
  from public.collaborator_compensation_settings cfg where cfg.seller_id=v_seller and cfg.team_id=v_team
    and cfg.effective_from<=p_changed_at order by cfg.effective_from desc limit 1;
  if coalesce(v_enabled,false) then
    v_bonus:=round(v_delta*0.20,2);
    v_weekly_bonus:=round(v_bonus/4,2);
  end if;
  v_effective_week:=p_effective_week;
  if v_effective_week is null then
    select numero_semana into v_effective_week from public.client_payments
    where client_id=p_client_id and coalesce(due_on,paid_on)>=p_changed_at order by numero_semana limit 1;
    if v_effective_week is null then select coalesce(max(numero_semana),0)+1 into v_effective_week from public.client_payments where client_id=p_client_id; end if;
  end if;
  if v_bonus>0 then
    insert into public.deals (seller_id,client_id,client_name,valor_total_usd,teto_semanas,valor_por_semana_usd,comissao_percentual,status,data_fechamento,team_id,kind)
    values(v_seller,p_client_id,v_cli.name||' (upgrade parcelado)',v_bonus,4,v_weekly_bonus,20,'concluido',p_changed_at,v_team,'upgrade')
    returning id into v_bonus_deal;
  end if;
  insert into public.plan_changes (client_id,seller_id,old_plan_id,new_plan_id,old_valor_semanal,new_valor_semanal,
    delta_mensal_usd,bonus_usd,changed_at,team_id,bonus_deal_id,bonus_payment_id,effective_week,observacao,changed_by)
  values(p_client_id,v_seller,v_cli.plano_id,p_new_plan_id,coalesce(v_old.valor_semanal,v_cli.plan_weekly),v_new.valor_semanal,
    v_delta,v_bonus,p_changed_at,v_team,v_bonus_deal,null,v_effective_week,nullif(trim(p_observacao),''),v_uid);
  update public.clients set plano_id=p_new_plan_id,plan_weekly=v_new.valor_semanal where id=p_client_id;
  update public.client_payments set plano_id=p_new_plan_id,valor_previsto_usd=v_new.valor_semanal,valor_usd=v_new.valor_semanal,updated_at=now()
    where client_id=p_client_id and numero_semana>=v_effective_week and status not in ('paga','parcial');
  -- Reexecuta o trigger para semanas efetivas que já tinham sido pagas antes do cadastro do upgrade.
  for v_paid in select id from public.client_payments
    where client_id=p_client_id and numero_semana>=v_effective_week and status='paga'
    order by numero_semana limit 4
  loop
    update public.client_payments set paid_on=paid_on where id=v_paid.id;
  end loop;
  return jsonb_build_object('bonus',v_bonus,'weeklyBonus',v_weekly_bonus,'installments',case when v_bonus>0 then 4 else 0 end,
    'deltaMensal',v_delta,'sellerId',v_seller,'effectiveWeek',v_effective_week);
exception when unique_violation then raise exception 'este upgrade ja foi registrado';
end;
$$;
revoke execute on function public.register_plan_upgrade_v2(uuid,uuid,date,uuid,integer,text) from public;
grant execute on function public.register_plan_upgrade_v2(uuid,uuid,date,uuid,integer,text) to authenticated;

create or replace function public.sync_upgrade_installments_from_payment()
returns trigger language plpgsql security definer set search_path=public
as $$
declare r record; v_existing uuid; v_number integer; v_created uuid; v_amount numeric;
begin
  if new.status <> 'paga' then
    delete from public.weekly_payments wp using public.plan_changes pc
    where wp.source_client_payment_id=new.id and wp.deal_id=pc.bonus_deal_id and pc.client_id=new.client_id;
    return new;
  end if;
  for r in select pc.id plan_change_id,pc.bonus_deal_id deal_id,d.teto_semanas,d.valor_por_semana_usd,d.valor_total_usd
    from public.plan_changes pc join public.deals d on d.id=pc.bonus_deal_id
    where pc.client_id=new.client_id and pc.bonus_deal_id is not null and pc.voided_at is null
      and new.numero_semana>=coalesce(pc.effective_week,1)
    order by pc.changed_at,pc.created_at
  loop
    select id into v_existing from public.weekly_payments where deal_id=r.deal_id and source_client_payment_id=new.id;
    if v_existing is not null then
      update public.weekly_payments set paid_on=new.paid_on,cotacao_usd_brl=new.cotacao_usd_brl where id=v_existing;
      continue;
    end if;
    select gs into v_number from generate_series(1,r.teto_semanas) gs
      where not exists(select 1 from public.weekly_payments wp where wp.deal_id=r.deal_id and wp.numero_semana=gs)
      order by gs limit 1;
    if v_number is null then continue; end if;
    v_amount:=case when v_number=r.teto_semanas then round(r.valor_total_usd-r.valor_por_semana_usd*(r.teto_semanas-1),2)
      else r.valor_por_semana_usd end;
    insert into public.weekly_payments(deal_id,numero_semana,valor_usd,paid_on,cotacao_usd_brl,team_id,source_client_payment_id)
    values(r.deal_id,v_number,v_amount,new.paid_on,new.cotacao_usd_brl,new.team_id,new.id) returning id into v_created;
    update public.plan_changes set bonus_payment_id=coalesce(bonus_payment_id,v_created) where id=r.plan_change_id;
  end loop;
  return new;
end;
$$;

create or replace function public.void_plan_upgrade(p_plan_change_id uuid,p_reason text default null)
returns void language plpgsql security definer set search_path=public
as $$
declare v_uid uuid:=auth.uid(); v_pc public.plan_changes;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_pc from public.plan_changes where id=p_plan_change_id and voided_at is null for update;
  if v_pc.id is null then raise exception 'upgrade inexistente ou ja cancelado'; end if;
  if not public.user_is_team_admin(v_pc.team_id) then raise exception 'sem permissao'; end if;
  if exists(select 1 from public.plan_changes x where x.client_id=v_pc.client_id and x.voided_at is null
    and (x.changed_at>v_pc.changed_at or (x.changed_at=v_pc.changed_at and x.created_at>v_pc.created_at))) then
    raise exception 'cancele primeiro o upgrade mais recente deste cliente';
  end if;
  update public.clients set plano_id=v_pc.old_plan_id,plan_weekly=v_pc.old_valor_semanal where id=v_pc.client_id;
  update public.client_payments set plano_id=v_pc.old_plan_id,valor_previsto_usd=v_pc.old_valor_semanal,
    valor_usd=v_pc.old_valor_semanal,updated_at=now()
    where client_id=v_pc.client_id and numero_semana>=coalesce(v_pc.effective_week,1) and status not in ('paga','parcial');
  if v_pc.bonus_deal_id is not null then
    update public.weekly_payments set deleted_at=now(),deleted_by=v_uid where deal_id=v_pc.bonus_deal_id and deleted_at is null;
    update public.deals set deleted_at=now(),deleted_by=v_uid where id=v_pc.bonus_deal_id and deleted_at is null;
  end if;
  update public.plan_changes set voided_at=now(),voided_by=v_uid,void_reason=nullif(trim(p_reason),'') where id=v_pc.id;
end;
$$;
revoke execute on function public.void_plan_upgrade(uuid,text) from public;
grant execute on function public.void_plan_upgrade(uuid,text) to authenticated;

-- Histórico de responsabilidade: uma renovação atrasada deve considerar quem cuidava do
-- cliente na data da renovação, não quem estiver atribuído no dia em que o cron fizer catch-up.
create table if not exists public.client_assignment_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  assigned_to uuid,
  assigned_name text,
  effective_from timestamptz not null default now(),
  team_id uuid not null references public.teams(id) on delete cascade
);
create index if not exists idx_client_assignment_history_asof
  on public.client_assignment_history(client_id,effective_from desc);
alter table public.client_assignment_history enable row level security;
drop policy if exists client_assignment_history_select on public.client_assignment_history;
create policy client_assignment_history_select on public.client_assignment_history for select
  using (team_id in (select user_team_ids()) and user_is_team_admin(team_id));

insert into public.client_assignment_history(client_id,assigned_to,assigned_name,effective_from,team_id)
select c.id,c.assigned_to,c.assigned_name,coalesce(c.created_at,now()),c.team_id
from public.clients c where c.team_id is not null
  and not exists(select 1 from public.client_assignment_history h where h.client_id=c.id);

create or replace function public.track_client_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' or old.assigned_to is distinct from new.assigned_to or old.assigned_name is distinct from new.assigned_name then
    insert into public.client_assignment_history(client_id,assigned_to,assigned_name,effective_from,team_id)
    values(new.id,new.assigned_to,new.assigned_name,now(),new.team_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_track_client_assignment on public.clients;
create trigger trg_track_client_assignment after insert or update of assigned_to,assigned_name on public.clients
for each row execute function public.track_client_assignment();

-- As renovações criadas daqui em diante ficam separadas das vendas nos relatórios.
create or replace function public.process_due_renewals(p_as_of date default current_date)
returns integer language plpgsql security definer set search_path=public
as $$
declare r record; v_deal uuid; v_payment uuid; v_renewal uuid; v_rate numeric; v_count integer:=0;
begin
  select case when cotacao_travada and cotacao_manual is not null then cotacao_manual else coalesce(cotacao_referencia,cotacao_manual,1) end
    into v_rate from public.fx_config where id=1;
  v_rate:=coalesce(v_rate,1);
  for r in
    with first_paid as (
      select c.id client_id,c.name client_name,c.team_id,cp.paid_on anchor_date
      from public.clients c join public.client_payments cp on cp.client_id=c.id and cp.numero_semana=1 and cp.status='paga' and cp.paid_on is not null
      where c.status='ativo' and c.deleted_at is null
    ), due as (
      select f.*,gs renewal_number,(f.anchor_date+(gs*interval '3 months'))::date renewal_date
      from first_paid f cross join generate_series(1,80) gs where (f.anchor_date+(gs*interval '3 months'))::date<=p_as_of
    )
    select d.*,s.id seller_id from due d
    join lateral (select h.assigned_to,h.assigned_name from public.client_assignment_history h
      where h.client_id=d.client_id and h.effective_from < (d.renewal_date+1)::timestamp
      order by h.effective_from desc limit 1) a on true
    join lateral (select s0.id from public.sellers s0 where s0.team_id=d.team_id and s0.status='ativo' and coalesce(s0.gera_comissao,true)
      and ((a.assigned_to is not null and s0.user_id=a.assigned_to) or (a.assigned_name is not null and lower(trim(s0.name))=lower(trim(a.assigned_name))))
      order by case when a.assigned_to is not null and s0.user_id=a.assigned_to then 0 else 1 end,s0.created_at limit 1) s on true
    join lateral (select cfg.renewal_bonus_enabled from public.collaborator_compensation_settings cfg
      where cfg.seller_id=s.id and cfg.team_id=d.team_id and cfg.effective_from<=d.renewal_date order by cfg.effective_from desc limit 1) cfg
      on cfg.renewal_bonus_enabled=true
    where not exists(select 1 from public.contract_renewals cr where cr.client_id=d.client_id and cr.renewal_number=d.renewal_number)
    order by d.renewal_date,d.client_id
  loop
    v_renewal:=null;
    insert into public.contract_renewals(client_id,seller_id,renewal_number,anchor_date,renewal_date,bonus_usd,team_id)
    values(r.client_id,r.seller_id,r.renewal_number,r.anchor_date,r.renewal_date,50,r.team_id)
    on conflict(client_id,renewal_number) do nothing returning id into v_renewal;
    if v_renewal is null then continue; end if;
    insert into public.deals(seller_id,client_id,client_name,valor_total_usd,teto_semanas,valor_por_semana_usd,comissao_percentual,status,data_fechamento,team_id,kind)
    values(r.seller_id,r.client_id,r.client_name||' (renovação trimestral)',50,1,50,null,'concluido',r.renewal_date,r.team_id,'renewal') returning id into v_deal;
    insert into public.weekly_payments(deal_id,numero_semana,valor_usd,paid_on,cotacao_usd_brl,team_id)
    values(v_deal,1,50,r.renewal_date,v_rate,r.team_id) returning id into v_payment;
    update public.contract_renewals set bonus_deal_id=v_deal,bonus_payment_id=v_payment where id=v_renewal;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.process_due_renewals(date) from public;
grant execute on function public.process_due_renewals(date) to service_role;
