-- BASELINE: nove tabelas que existiam em PRODUÇÃO sem CREATE TABLE no repositório.
--
-- Achado em revisão geral: o repo tinha 72 migrations mas nenhuma criava `stage_events`, `onboarding_steps`,
-- `client_onboarding`, `client_integrations`, `nichos`, `marketing_investments`, `calls`,
-- `google_oauth_tokens` e `seller_comp_config`. Algumas nasceram antes da pasta de migrations existir;
-- `onboarding_steps` e `client_onboarding` eu mesmo criei direto no banco e esqueci de gravar aqui.
--
-- Consequência prática: o banco NÃO podia ser reconstruído do zero — um ambiente novo subiria sem as
-- tabelas que o funil (stage_events), o onboarding e o custo de marketing dependem.
--
-- Esta migration é DOCUMENTAL: tudo é `if not exists` / `drop policy if exists`, extraído do schema real
-- em 18/10/2026. Rodar contra a produção atual é no-op; contra um banco vazio, recria o que faltava.
-- NÃO altera nada do que já existe.

begin;

-- ── stage_events: histórico de movimentação do funil ───────────────────────────────────────────────
-- É a fonte de "Reunião Realizada" no relatório (transição Reunião Agendada → Proposta em Análise) e de
-- toda a análise de gargalo. Perder esta tabela é perder o funil inteiro.
create table if not exists public.stage_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  lead_name text,
  from_stage text,
  to_stage text not null,
  seller_id uuid,
  seller_name text,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  team_id uuid references public.teams(id) on delete cascade
);
create index if not exists idx_stage_events_changed_at on public.stage_events (changed_at);
create index if not exists idx_stage_events_lead on public.stage_events (lead_id);
create index if not exists idx_stage_events_team on public.stage_events (team_id);
create index if not exists idx_stage_events_to_stage_changed on public.stage_events (to_stage, changed_at);
alter table public.stage_events enable row level security;
drop policy if exists stage_events_select on public.stage_events;
create policy stage_events_select on public.stage_events for select
  using (team_id in (select public.user_team_ids()));
drop policy if exists stage_events_insert on public.stage_events;
create policy stage_events_insert on public.stage_events for insert
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
drop policy if exists stage_events_update on public.stage_events;
create policy stage_events_update on public.stage_events for update
  using (public.user_has_module_level(team_id, 'comercial', 'edit'))
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
drop policy if exists stage_events_delete on public.stage_events;
create policy stage_events_delete on public.stage_events for delete
  using (public.user_has_module_level(team_id, 'comercial', 'edit'));

-- ── onboarding_steps: o ROTEIRO da reunião de onboarding ───────────────────────────────────────────
-- Hierarquia de UM nível (tópico → subtópico). Os índices únicos parciais garantem posição sem buracos
-- por nível e são a base do swap_onboarding_steps (troca atômica).
create table if not exists public.onboarding_steps (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  parent_id uuid references public.onboarding_steps(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) > 0),
  ajuda text,
  pede_resposta boolean not null default false,
  rotulo_resposta text,
  exemplo_resposta text,
  posicao integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists onboarding_steps_parent_idx on public.onboarding_steps (parent_id);
create index if not exists onboarding_steps_team_idx on public.onboarding_steps (team_id, ativo, posicao);
create unique index if not exists onboarding_steps_pos_raiz_uk
  on public.onboarding_steps (team_id, posicao) where (parent_id is null and ativo);
create unique index if not exists onboarding_steps_pos_filho_uk
  on public.onboarding_steps (parent_id, posicao) where (parent_id is not null and ativo);
alter table public.onboarding_steps enable row level security;
drop policy if exists onboarding_steps_select on public.onboarding_steps;
create policy onboarding_steps_select on public.onboarding_steps for select
  using (public.user_has_module_level(team_id, 'clientes', 'view'));
drop policy if exists onboarding_steps_write on public.onboarding_steps;
create policy onboarding_steps_write on public.onboarding_steps for all
  using (public.user_has_module_level(team_id, 'clientes', 'edit'))
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));

-- ── client_onboarding: a RESPOSTA de cada cliente a cada etapa ─────────────────────────────────────
-- Uma linha por etapa TOCADA; etapa sem linha é "aberta". O único (client_id, step_id) sustenta o upsert.
create table if not exists public.client_onboarding (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  step_id uuid not null references public.onboarding_steps(id) on delete cascade,
  status text not null check (status in ('concluido', 'pendente')),
  resposta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint client_onboarding_client_step_uk unique (client_id, step_id)
);
create index if not exists client_onboarding_client_idx on public.client_onboarding (team_id, client_id);
alter table public.client_onboarding enable row level security;
drop policy if exists client_onboarding_select on public.client_onboarding;
create policy client_onboarding_select on public.client_onboarding for select
  using (public.user_has_module_level(team_id, 'clientes', 'view'));
drop policy if exists client_onboarding_write on public.client_onboarding;
create policy client_onboarding_write on public.client_onboarding for all
  using (public.user_has_module_level(team_id, 'clientes', 'edit'))
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));

-- ── client_integrations: automação de WhatsApp por cliente ─────────────────────────────────────────
create table if not exists public.client_integrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  ativo boolean not null default false,
  instancia text,
  numero_destino text,
  template text,
  landing_pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  team_id uuid references public.teams(id) on delete cascade
);
create index if not exists idx_client_integrations_team on public.client_integrations (team_id);
alter table public.client_integrations enable row level security;
drop policy if exists client_integrations_select on public.client_integrations;
create policy client_integrations_select on public.client_integrations for select
  using (team_id in (select public.user_team_ids()));
drop policy if exists client_integrations_insert on public.client_integrations;
create policy client_integrations_insert on public.client_integrations for insert
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));
drop policy if exists client_integrations_update on public.client_integrations;
create policy client_integrations_update on public.client_integrations for update
  using (public.user_has_module_level(team_id, 'clientes', 'edit'))
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));
drop policy if exists client_integrations_delete on public.client_integrations;
create policy client_integrations_delete on public.client_integrations for delete
  using (public.user_has_module_level(team_id, 'clientes', 'edit'));

-- ── nichos: as "prateleiras" do Hub de Clientes ────────────────────────────────────────────────────
create table if not exists public.nichos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text not null default '#646b73',
  posicao integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  team_id uuid references public.teams(id) on delete cascade
);
create index if not exists idx_nichos_team on public.nichos (team_id);
alter table public.nichos enable row level security;
drop policy if exists nichos_select on public.nichos;
create policy nichos_select on public.nichos for select
  using (team_id in (select public.user_team_ids()));
drop policy if exists nichos_insert on public.nichos;
create policy nichos_insert on public.nichos for insert
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));
drop policy if exists nichos_update on public.nichos;
create policy nichos_update on public.nichos for update
  using (public.user_has_module_level(team_id, 'clientes', 'edit'))
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));
drop policy if exists nichos_delete on public.nichos;
create policy nichos_delete on public.nichos for delete
  using (public.user_has_module_level(team_id, 'clientes', 'edit'));

-- ── marketing_investments: base do Custo por Lead / Custo por Reunião ──────────────────────────────
create table if not exists public.marketing_investments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id),
  spent_on date not null default current_date,
  amount_usd numeric(12,2) not null check (amount_usd >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_marketing_investments_team_date on public.marketing_investments (team_id, spent_on);
alter table public.marketing_investments enable row level security;
drop policy if exists team_scope on public.marketing_investments;
create policy team_scope on public.marketing_investments for all
  using (team_id in (select public.user_team_ids()))
  with check (team_id in (select public.user_team_ids()));

-- ── calls: ligações importadas (gravação, transcrição, resumo) ─────────────────────────────────────
-- external_id é único: é o que torna a importação idempotente contra reenvio do provedor.
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid,
  direction text,
  started_at timestamptz,
  duration_seconds integer,
  transcript text,
  summary text,
  recording_url text,
  contact_phone text,
  provider text not null default 'ghl',
  external_id text unique,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  team_id uuid references public.teams(id) on delete cascade
);
create index if not exists calls_lead_id_idx on public.calls (lead_id);
create index if not exists calls_client_id_idx on public.calls (client_id);
create index if not exists calls_started_at_idx on public.calls (started_at desc);
create index if not exists idx_calls_team on public.calls (team_id);
alter table public.calls enable row level security;
drop policy if exists calls_select on public.calls;
create policy calls_select on public.calls for select
  using (team_id in (select public.user_team_ids()));
drop policy if exists calls_insert on public.calls;
create policy calls_insert on public.calls for insert
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
drop policy if exists calls_update on public.calls;
create policy calls_update on public.calls for update
  using (public.user_has_module_level(team_id, 'comercial', 'edit'))
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
drop policy if exists calls_delete on public.calls;
create policy calls_delete on public.calls for delete
  using (public.user_has_module_level(team_id, 'comercial', 'edit'));

-- ── google_oauth_tokens: credenciais do Google Agenda por usuário ──────────────────────────────────
-- RLS LIGADA e SEM POLÍTICA de propósito: isso nega tudo para o cliente do usuário. O acesso é só pelo
-- service role (lib/google/oauth.ts), que é o certo para guardar refresh token.
create table if not exists public.google_oauth_tokens (
  user_id uuid primary key,
  google_email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.google_oauth_tokens enable row level security;

-- ── seller_comp_config: modelo de remuneração versionado por vigência ──────────────────────────────
create table if not exists public.seller_comp_config (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  team_id uuid references public.teams(id),
  effective_from date not null default current_date,
  salario_fixo_usd numeric(12,2) not null default 0,
  comissao_tipo text not null default 'percent' check (comissao_tipo in ('percent','fixed','none')),
  comissao_valor numeric(12,2) not null default 0,
  comissao_base text not null default 'semanal' check (comissao_base in ('semanal','mensal','contrato')),
  reuniao_tipo text not null default 'none' check (reuniao_tipo in ('percent','fixed','none')),
  reuniao_valor numeric(12,2) not null default 0,
  renovacao_tipo text not null default 'none' check (renovacao_tipo in ('percent','fixed','none')),
  renovacao_valor numeric(12,2) not null default 0,
  renovacao_apos_meses integer not null default 3,
  upgrade_ativo boolean not null default false,
  upgrade_tipo text not null default 'percent' check (upgrade_tipo in ('percent','fixed')),
  upgrade_valor numeric(12,2) not null default 100,
  reconhecimento text not null default 'por_semana' check (reconhecimento in ('por_semana','na_conclusao')),
  created_at timestamptz not null default now(),
  constraint seller_comp_config_seller_id_effective_from_key unique (seller_id, effective_from)
);
create index if not exists idx_scc_seller on public.seller_comp_config (seller_id, effective_from desc);
alter table public.seller_comp_config enable row level security;
drop policy if exists seller_comp_config_select on public.seller_comp_config;
create policy seller_comp_config_select on public.seller_comp_config for select
  using (team_id in (select public.user_team_ids()));
drop policy if exists seller_comp_config_insert on public.seller_comp_config;
create policy seller_comp_config_insert on public.seller_comp_config for insert
  with check (public.user_has_module_level(team_id, 'financeiro', 'admin'));
drop policy if exists seller_comp_config_update on public.seller_comp_config;
create policy seller_comp_config_update on public.seller_comp_config for update
  using (public.user_has_module_level(team_id, 'financeiro', 'admin'))
  with check (public.user_has_module_level(team_id, 'financeiro', 'admin'));
drop policy if exists seller_comp_config_delete on public.seller_comp_config;
create policy seller_comp_config_delete on public.seller_comp_config for delete
  using (public.user_has_module_level(team_id, 'financeiro', 'admin'));

commit;
