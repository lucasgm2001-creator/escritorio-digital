-- 061 — Renovação trimestral a partir da primeira semana paga.
-- Bônus fixo de US$50, somente para o vendedor responsável cuja regra esteja ativa.

create table if not exists public.contract_renewals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete restrict,
  renewal_number integer not null check (renewal_number >= 1),
  anchor_date date not null,
  renewal_date date not null,
  bonus_usd numeric not null default 50 check (bonus_usd = 50),
  bonus_deal_id uuid references public.deals(id) on delete set null,
  bonus_payment_id uuid references public.weekly_payments(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, renewal_number)
);
create index if not exists idx_contract_renewals_date on public.contract_renewals(team_id, renewal_date);
create index if not exists idx_contract_renewals_seller on public.contract_renewals(seller_id, renewal_date);
alter table public.contract_renewals enable row level security;
create policy contract_renewals_select on public.contract_renewals for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id) or seller_id in (select user_seller_ids())));

create or replace function public.process_due_renewals(p_as_of date default current_date)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_deal uuid;
  v_payment uuid;
  v_renewal uuid;
  v_rate numeric;
  v_count integer := 0;
begin
  -- Mesma cotação efetiva do financeiro; o valor-base permanece US$50.
  select case when cotacao_travada and cotacao_manual is not null then cotacao_manual
              else coalesce(cotacao_referencia, cotacao_manual, 1) end
    into v_rate from public.fx_config where id = 1;
  v_rate := coalesce(v_rate, 1);

  for r in
    with first_paid as (
      select c.id client_id, c.name client_name, c.team_id, c.assigned_to, c.assigned_name,
             cp.paid_on anchor_date
      from public.clients c
      join public.client_payments cp on cp.client_id = c.id
       and cp.numero_semana = 1 and cp.status = 'paga' and cp.paid_on is not null
      where c.status = 'ativo' and c.deleted_at is null
    ), due as (
      select f.*, gs renewal_number,
             (f.anchor_date + (gs * interval '3 months'))::date renewal_date
      from first_paid f cross join generate_series(1, 80) gs
      where (f.anchor_date + (gs * interval '3 months'))::date <= p_as_of
    )
    select d.*, s.id seller_id
    from due d
    join lateral (
      select s0.id
      from public.sellers s0
      where s0.team_id = d.team_id and s0.status = 'ativo'
        and ((d.assigned_to is not null and s0.user_id = d.assigned_to)
          or (d.assigned_name is not null and lower(trim(s0.name)) = lower(trim(d.assigned_name))))
      order by case when d.assigned_to is not null and s0.user_id = d.assigned_to then 0 else 1 end,
               s0.created_at
      limit 1
    ) s on true
    join lateral (
      select cfg.renewal_bonus_enabled
      from public.collaborator_compensation_settings cfg
      where cfg.seller_id = s.id and cfg.team_id = d.team_id
        and cfg.effective_from <= d.renewal_date
      order by cfg.effective_from desc limit 1
    ) cfg on cfg.renewal_bonus_enabled = true
    where not exists (
      select 1 from public.contract_renewals cr
      where cr.client_id = d.client_id and cr.renewal_number = d.renewal_number
    )
    order by d.renewal_date, d.client_id
  loop
    v_renewal := null;
    insert into public.contract_renewals (
      client_id, seller_id, renewal_number, anchor_date, renewal_date, bonus_usd, team_id
    ) values (
      r.client_id, r.seller_id, r.renewal_number, r.anchor_date, r.renewal_date, 50, r.team_id
    ) on conflict (client_id, renewal_number) do nothing
    returning id into v_renewal;
    if v_renewal is null then continue; end if;

    insert into public.deals (
      seller_id, client_id, client_name, valor_total_usd, teto_semanas, valor_por_semana_usd,
      comissao_percentual, status, data_fechamento, team_id
    ) values (
      r.seller_id, r.client_id, r.client_name || ' (renovação trimestral)', 50, 1, 50,
      null, 'concluido', r.renewal_date, r.team_id
    ) returning id into v_deal;

    insert into public.weekly_payments (
      deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl, team_id
    ) values (v_deal, 1, 50, r.renewal_date, v_rate, r.team_id)
    returning id into v_payment;

    update public.contract_renewals
       set bonus_deal_id = v_deal, bonus_payment_id = v_payment
     where id = v_renewal;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.process_due_renewals(date) from public;
grant execute on function public.process_due_renewals(date) to service_role;

-- A regra pedida é sempre fixa em US$50; mantém o liga/desliga individual já existente.
update public.collaborator_compensation_settings
set renewal_bonus_type = 'fixed', renewal_bonus_value = 50, updated_at = now()
where renewal_bonus_enabled = true;
