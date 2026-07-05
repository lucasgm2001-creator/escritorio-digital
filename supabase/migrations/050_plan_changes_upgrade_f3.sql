-- 050 F3 — Upgrade de plano (ADITIVO). plan_changes = o EVENTO de upgrade que faltava. A config
-- upgrade_commission_* (collaborator_compensation_settings) e o engine já existiam; aqui só se cria a
-- fonte do evento + auditoria do bônus. O código (applyPlanUpgrade) lança o bônus reusando o motor VIVO
-- (weekly_payment num deal-delta status 'concluido' → monthlySummary por paid_on), sem 2º motor.
-- RLS = own-or-admin (mesmo padrão de deals, migração 047). APLICADA após revisão do usuário.
create table if not exists public.plan_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  seller_id uuid references public.sellers(id),
  old_plan_id uuid references public.plans(id),
  new_plan_id uuid references public.plans(id),
  old_valor_semanal numeric,
  new_valor_semanal numeric,
  delta_mensal_usd numeric not null,
  bonus_usd numeric not null,
  changed_at date not null,
  team_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_plan_changes_client on public.plan_changes(client_id);
create index if not exists idx_plan_changes_changed_at on public.plan_changes(changed_at);
alter table public.plan_changes enable row level security;

create policy plan_changes_select on public.plan_changes for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id) or seller_id in (select user_seller_ids())));
create policy plan_changes_insert on public.plan_changes for insert
  with check (team_id in (select user_team_ids()));
create policy plan_changes_update on public.plan_changes for update
  using (team_id in (select user_team_ids())) with check (team_id in (select user_team_ids()));
create policy plan_changes_delete on public.plan_changes for delete
  using (team_id in (select user_team_ids()));
