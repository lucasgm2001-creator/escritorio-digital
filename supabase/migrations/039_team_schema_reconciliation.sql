-- 039_team_schema_reconciliation.sql
--
-- Reconciliacao segura do schema de equipes com o banco real de producao.
--
-- CUIDADO: os IDs abaixo pertencem aos dados reais atuais do Escritorio Digital v2.
-- Eles devem ser preservados. Esta migration NAO troca IDs existentes, NAO apaga
-- dados, NAO recria tabelas reais e NAO endurece RLS.
--
-- Equipe real atual:
--   team_id  = 7cf9b5d3-e42f-48d7-bfdf-575736e72827
--   nome     = DR Growth          (sera renomeada para DR Growth M.)
--
-- Usuario real atual:
--   Lucas user_id = 623dd724-ddeb-426c-956a-4c71f6653fa5
--   Lucas deve permanecer owner/admin da equipe inicial.
--
-- Regras desta migration:
--   * 100% aditiva e idempotente.
--   * Sem DROP TABLE.
--   * Sem TRUNCATE.
--   * Sem recriar tabelas existentes.
--   * Sem alterar registros que ja possuem team_id.
--   * Sem criar Daniel.
--   * Sem tornar team_id NOT NULL.
--   * Sem alterar policies/RLS nesta etapa.

-- ============================================================
-- 1. Estrutura base de equipes
-- ============================================================

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid,
  created_at timestamptz not null default now()
);

alter table public.teams add column if not exists id         uuid default gen_random_uuid();
alter table public.teams add column if not exists name       text;
alter table public.teams add column if not exists owner_id   uuid;
alter table public.teams add column if not exists created_at timestamptz default now();

create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references public.teams(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.team_members add column if not exists id          uuid default gen_random_uuid();
alter table public.team_members add column if not exists team_id     uuid;
alter table public.team_members add column if not exists user_id     uuid;
alter table public.team_members add column if not exists role        text default 'member';
alter table public.team_members add column if not exists permissions jsonb default '{}'::jsonb;
alter table public.team_members add column if not exists created_at  timestamptz default now();

create table if not exists public.team_invites (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid references public.teams(id) on delete cascade,
  token      text,
  created_by uuid references public.profiles(id) on delete set null,
  used_by    uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table public.team_invites add column if not exists id         uuid default gen_random_uuid();
alter table public.team_invites add column if not exists team_id    uuid;
alter table public.team_invites add column if not exists token      text;
alter table public.team_invites add column if not exists created_by uuid;
alter table public.team_invites add column if not exists used_by    uuid;
alter table public.team_invites add column if not exists expires_at timestamptz;
alter table public.team_invites add column if not exists used_at    timestamptz;
alter table public.team_invites add column if not exists created_at timestamptz default now();

create unique index if not exists uq_team_members_team_user
  on public.team_members (team_id, user_id);

create unique index if not exists uq_team_invites_token
  on public.team_invites (token)
  where token is not null;

create index if not exists idx_team_members_user_id
  on public.team_members (user_id);

create index if not exists idx_team_invites_team_id
  on public.team_invites (team_id);

-- ============================================================
-- 2. Preservar equipe real atual e Lucas como owner
-- ============================================================

-- Insere a equipe inicial apenas se ela nao existir, e somente se o profile real
-- do Lucas existir. No banco atual de producao ela ja existe; portanto isso e no-op.
insert into public.teams (id, name, owner_id)
select
  '7cf9b5d3-e42f-48d7-bfdf-575736e72827'::uuid,
  'DR Growth M.',
  '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid
where exists (
  select 1
  from public.profiles
  where id = '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid
)
on conflict (id) do nothing;

-- Renomeia somente a equipe real existente "DR Growth" para "DR Growth M.",
-- preservando o mesmo ID. Nao altera outras equipes.
update public.teams
   set name = 'DR Growth M.'
 where id = '7cf9b5d3-e42f-48d7-bfdf-575736e72827'::uuid
   and name = 'DR Growth';

-- Garante o owner_id real do Lucas nessa equipe inicial.
update public.teams
   set owner_id = '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid
 where id = '7cf9b5d3-e42f-48d7-bfdf-575736e72827'::uuid
   and exists (
     select 1
     from public.profiles
     where id = '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid
   );

-- Cria a associacao Lucas -> equipe inicial apenas se necessario.
insert into public.team_members (team_id, user_id, role, permissions)
select
  '7cf9b5d3-e42f-48d7-bfdf-575736e72827'::uuid,
  '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid,
  'owner',
  '{}'::jsonb
where exists (
  select 1
  from public.teams
  where id = '7cf9b5d3-e42f-48d7-bfdf-575736e72827'::uuid
)
and exists (
  select 1
  from public.profiles
  where id = '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid
)
on conflict (team_id, user_id) do nothing;

-- Se a associacao ja existia com outro papel, Lucas volta a ser owner.
update public.team_members
   set role = 'owner',
       permissions = coalesce(permissions, '{}'::jsonb)
 where team_id = '7cf9b5d3-e42f-48d7-bfdf-575736e72827'::uuid
   and user_id = '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid;

-- ============================================================
-- 3. Garantir team_id nas tabelas de negocio
-- ============================================================

do $$
declare
  tbl text;
  tables_with_team_id text[] := array[
    'leads',
    'lead_interactions',
    'clients',
    'client_payments',
    'client_integrations',
    'sellers',
    'seller_salaries',
    'deals',
    'weekly_payments',
    'meetings',
    'tasks',
    'calendar_events',
    'activities',
    'notices',
    'news',
    'lead_milestones',
    'plans',
    'presentations',
    'presentation_materials',
    'funnel_stages',
    'nichos',
    'stage_events',
    'fx_config',
    -- Tabelas de migrations antigas; podem nao existir no banco real atual,
    -- mas recebem team_id se existirem em outro ambiente.
    'commissions',
    'payments',
    'campaigns',
    'expenses'
  ];
begin
  foreach tbl in array tables_with_team_id loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = tbl
    ) then
      execute format(
        'alter table public.%I add column if not exists team_id uuid references public.teams(id) on delete set null',
        tbl
      );

      execute format(
        'create index if not exists %I on public.%I (team_id)',
        'idx_' || tbl || '_team_id',
        tbl
      );
    end if;
  end loop;
end $$;

-- ============================================================
-- 4. Backfill seguro: apenas registros sem team_id
-- ============================================================

do $$
declare
  tbl text;
  tables_with_team_id text[] := array[
    'leads',
    'lead_interactions',
    'clients',
    'client_payments',
    'client_integrations',
    'sellers',
    'seller_salaries',
    'deals',
    'weekly_payments',
    'meetings',
    'tasks',
    'calendar_events',
    'activities',
    'notices',
    'news',
    'lead_milestones',
    'plans',
    'presentations',
    'presentation_materials',
    'funnel_stages',
    'nichos',
    'stage_events',
    'fx_config',
    'commissions',
    'payments',
    'campaigns',
    'expenses'
  ];
begin
  foreach tbl in array tables_with_team_id loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = tbl
        and column_name = 'team_id'
    ) then
      execute format(
        'update public.%I set team_id = %L::uuid where team_id is null',
        tbl,
        '7cf9b5d3-e42f-48d7-bfdf-575736e72827'
      );
    end if;
  end loop;
end $$;

-- ============================================================
-- 5. Verificacao manual sugerida apos aplicar
-- ============================================================
--
-- select id, name, owner_id from public.teams
-- where id = '7cf9b5d3-e42f-48d7-bfdf-575736e72827';
--
-- select team_id, user_id, role from public.team_members
-- where team_id = '7cf9b5d3-e42f-48d7-bfdf-575736e72827'
--   and user_id = '623dd724-ddeb-426c-956a-4c71f6653fa5';
--
-- select count(*) from public.stage_events where team_id is null;
