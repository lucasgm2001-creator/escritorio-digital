-- 062 — Upgrade: 20% da diferença mensal, dividido em 4 parcelas e liberado conforme o cliente paga.

alter table public.weekly_payments
  add column if not exists source_client_payment_id uuid references public.client_payments(id) on delete set null;
create unique index if not exists uq_weekly_upgrade_source
  on public.weekly_payments(deal_id, source_client_payment_id)
  where source_client_payment_id is not null;

-- Lucas começa com o perfil ativo. Daniel (e qualquer seller sem comissão) permanece inelegível.
update public.collaborator_compensation_settings cfg
set upgrade_commission_enabled = true,
    upgrade_commission_type = 'percentage',
    upgrade_commission_value = 20,
    upgrade_commission_base = 'plan_difference',
    updated_at = now()
from public.sellers s
where s.id = cfg.seller_id and lower(trim(s.name)) = 'lucas' and coalesce(s.gera_comissao, true);

insert into public.collaborator_compensation_settings (
  team_id, seller_id, upgrade_commission_enabled, upgrade_commission_type,
  upgrade_commission_value, upgrade_commission_base, effective_from
)
select s.team_id, s.id, true, 'percentage', 20, 'plan_difference', current_date
from public.sellers s
where lower(trim(s.name)) = 'lucas' and s.status = 'ativo' and coalesce(s.gera_comissao, true)
  and not exists (select 1 from public.collaborator_compensation_settings c where c.seller_id = s.id);

update public.collaborator_compensation_settings cfg
set upgrade_commission_enabled = false, updated_at = now()
from public.sellers s
where s.id = cfg.seller_id and (lower(trim(s.name)) = 'daniel' or not coalesce(s.gera_comissao, true));

-- Substitui o lançamento imediato: cria o contrato de bônus com quatro parcelas, mas nenhuma é paga ainda.
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
  v_weekly_bonus numeric := 0;
  v_effective_week integer;
  v_enabled boolean := false;
  v_bonus_deal uuid;
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

  if v_seller is null then
    select id into v_seller from public.sellers
    where team_id = v_team and status = 'ativo' and lower(trim(name)) = 'lucas' and coalesce(gera_comissao, true)
    order by created_at limit 1;
  end if;
  if v_seller is null then raise exception 'selecione o vendedor do upgrade'; end if;
  if not exists (select 1 from public.sellers where id = v_seller and team_id = v_team and status = 'ativo' and coalesce(gera_comissao, true)) then
    raise exception 'vendedor sem perfil de comissao';
  end if;

  select coalesce(cfg.upgrade_commission_enabled, false) into v_enabled
  from public.collaborator_compensation_settings cfg
  where cfg.seller_id = v_seller and cfg.team_id = v_team and cfg.effective_from <= p_changed_at
  order by cfg.effective_from desc limit 1;

  -- Regra única: 20% da diferença mensal, em quatro parcelas iguais.
  if coalesce(v_enabled, false) then
    v_bonus := round(v_delta * 0.20, 2);
    v_weekly_bonus := round(v_bonus / 4, 2);
    -- Ajusta eventual centavo para que as quatro parcelas somem exatamente ao total.
    v_bonus := v_weekly_bonus * 4;
  end if;

  v_effective_week := p_effective_week;
  if v_effective_week is null then
    select numero_semana into v_effective_week
    from public.client_payments
    where client_id = p_client_id and coalesce(due_on, paid_on) >= p_changed_at
    order by numero_semana limit 1;
    if v_effective_week is null then
      select coalesce(max(numero_semana), 0) + 1 into v_effective_week
      from public.client_payments where client_id = p_client_id;
    end if;
  end if;

  if v_bonus > 0 then
    insert into public.deals (
      seller_id, client_id, client_name, valor_total_usd, teto_semanas, valor_por_semana_usd,
      comissao_percentual, status, data_fechamento, team_id
    ) values (
      v_seller, p_client_id, v_cli.name || ' (upgrade parcelado)', v_bonus, 4, v_weekly_bonus,
      20, 'concluido', p_changed_at, v_team
    ) returning id into v_bonus_deal;
  end if;

  insert into public.plan_changes (
    client_id, seller_id, old_plan_id, new_plan_id, old_valor_semanal, new_valor_semanal,
    delta_mensal_usd, bonus_usd, changed_at, team_id, bonus_deal_id, bonus_payment_id,
    effective_week, observacao, changed_by
  ) values (
    p_client_id, v_seller, v_cli.plano_id, p_new_plan_id, coalesce(v_old.valor_semanal, v_cli.plan_weekly),
    v_new.valor_semanal, v_delta, v_bonus, p_changed_at, v_team, v_bonus_deal, null,
    v_effective_week, nullif(trim(p_observacao), ''), v_uid
  );

  update public.clients set plano_id = p_new_plan_id, plan_weekly = v_new.valor_semanal where id = p_client_id;
  return jsonb_build_object(
    'bonus', v_bonus, 'weeklyBonus', v_weekly_bonus, 'installments', case when v_bonus > 0 then 4 else 0 end,
    'deltaMensal', v_delta, 'sellerId', v_seller, 'effectiveWeek', v_effective_week
  );
exception when unique_violation then
  raise exception 'este upgrade ja foi registrado';
end;
$$;

-- Cada semana paga libera a próxima parcela de cada upgrade aplicável. Reverter o pagamento remove a parcela.
create or replace function public.sync_upgrade_installments_from_payment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_existing uuid;
  v_number integer;
  v_created uuid;
begin
  if new.status <> 'paga' then
    delete from public.weekly_payments wp
    using public.plan_changes pc
    where wp.source_client_payment_id = new.id
      and wp.deal_id = pc.bonus_deal_id and pc.client_id = new.client_id;
    return new;
  end if;

  for r in
    select pc.id plan_change_id, pc.bonus_deal_id deal_id, d.teto_semanas, d.valor_por_semana_usd
    from public.plan_changes pc
    join public.deals d on d.id = pc.bonus_deal_id
    where pc.client_id = new.client_id and pc.bonus_deal_id is not null
      and new.numero_semana >= coalesce(pc.effective_week, 1)
    order by pc.changed_at, pc.created_at
  loop
    select id into v_existing from public.weekly_payments
    where deal_id = r.deal_id and source_client_payment_id = new.id;
    if v_existing is not null then
      update public.weekly_payments set paid_on = new.paid_on, cotacao_usd_brl = new.cotacao_usd_brl
      where id = v_existing;
      continue;
    end if;

    select gs into v_number from generate_series(1, r.teto_semanas) gs
    where not exists (select 1 from public.weekly_payments wp where wp.deal_id = r.deal_id and wp.numero_semana = gs)
    order by gs limit 1;
    if v_number is null then continue; end if;

    insert into public.weekly_payments (
      deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl, team_id, source_client_payment_id
    ) values (
      r.deal_id, v_number, r.valor_por_semana_usd, new.paid_on, new.cotacao_usd_brl, new.team_id, new.id
    ) returning id into v_created;
    update public.plan_changes set bonus_payment_id = coalesce(bonus_payment_id, v_created) where id = r.plan_change_id;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_sync_upgrade_installments on public.client_payments;
create trigger trg_sync_upgrade_installments
after insert or update of status, paid_on, cotacao_usd_brl on public.client_payments
for each row execute function public.sync_upgrade_installments_from_payment();
