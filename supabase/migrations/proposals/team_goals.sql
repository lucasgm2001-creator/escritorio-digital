-- ============================================================================
-- PROPOSTA DE MIGRATION — team_goals  (EXECUTIVE-METRICS-001, Parte 8)
-- ⚠️ NÃO APLICADA. Requer autorização explícita do usuário antes de rodar.
-- Nasce preparada para: meta mensal/semanal, por vendedor/por equipe,
-- de receita/clientes/reuniões/conversão (mesmo que usemos poucas no início).
-- Team-scoped (TEAM-001). RLS: leitura da equipe; escrita owner/admin.
-- ============================================================================

create table if not exists public.team_goals (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,

  -- Escopo da meta: da EQUIPE inteira ou de um VENDEDOR específico.
  scope        text not null default 'team' check (scope in ('team','seller')),
  seller_id    uuid references public.sellers(id) on delete cascade,  -- null quando scope='team'

  -- QUAL indicador a meta acompanha (bate com o KPI Registry).
  metric       text not null check (metric in ('receita','clientes','reunioes','conversao')),

  -- Granularidade + âncora do período (1º dia da semana/mês da meta).
  period       text not null check (period in ('semana','mes')),
  period_start date not null,

  -- Valor alvo: USD (receita), contagem (clientes/reuniões) ou % 0..100 (conversão).
  target       numeric not null check (target >= 0),

  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles(id),
  updated_at   timestamptz not null default now(),

  -- Coerência: meta de vendedor exige seller_id; meta de equipe não tem seller_id.
  constraint team_goals_scope_seller check (
    (scope = 'seller' and seller_id is not null) or
    (scope = 'team'   and seller_id is null)
  )
);

-- Uma meta por (equipe/vendedor × métrica × período × âncora). Índices parciais porque seller_id é NULL
-- no escopo de equipe (NULLs não deduplicam num unique comum).
create unique index if not exists team_goals_uk_team
  on public.team_goals (team_id, metric, period, period_start)
  where scope = 'team';
create unique index if not exists team_goals_uk_seller
  on public.team_goals (team_id, seller_id, metric, period, period_start)
  where scope = 'seller';

create index if not exists team_goals_lookup
  on public.team_goals (team_id, metric, period, period_start);

-- updated_at automático (reusa o padrão do projeto, se existir set_updated_at()).
drop trigger if exists team_goals_set_updated_at on public.team_goals;
create trigger team_goals_set_updated_at
  before update on public.team_goals
  for each row execute function public.set_updated_at();

-- ── RLS: team-scope na leitura; escrita só owner/admin da equipe ativa. ──
alter table public.team_goals enable row level security;

drop policy if exists team_goals_select on public.team_goals;
create policy team_goals_select on public.team_goals
  for select using (
    team_id in (select tm.team_id from public.team_members tm where tm.user_id = auth.uid())
  );

drop policy if exists team_goals_write on public.team_goals;
create policy team_goals_write on public.team_goals
  for all using (
    team_id in (
      select tm.team_id from public.team_members tm
      where tm.user_id = auth.uid() and tm.role in ('owner','admin')
    )
  ) with check (
    team_id in (
      select tm.team_id from public.team_members tm
      where tm.user_id = auth.uid() and tm.role in ('owner','admin')
    )
  );

-- ============================================================================
-- Consumo (quando aplicada): ExecutiveMetricsService lê team_goals p/ a "Meta"
-- do gráfico de 12 meses e do Financeiro. Nenhuma tela grava direto — via server
-- action gated (owner/admin), como as demais escritas do sistema.
-- ============================================================================
