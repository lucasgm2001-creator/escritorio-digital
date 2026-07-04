-- 044_team_members_rh_fields.sql
--
-- PERSONAL-WORK-001 / COLLABORATORS-REAL-001 — Fase 1 (autorizada).
-- Fatos de RH POR EQUIPE no vínculo team_members: cargo, departamento, gestor, entrada e status.
-- Fonte oficial: docs/proposta-migration-people-compensation.md
--
-- Esta migration:
--   * é 100% aditiva e idempotente (add column if not exists / índices if not exists);
--   * NÃO toca em colunas existentes (id, team_id, user_id, role, permissions, created_at);
--   * NÃO remove/recria tabela, NÃO faz DROP/TRUNCATE, NÃO apaga dados;
--   * NÃO altera RLS/policies (as novas colunas herdam a RLS já existente de team_members);
--   * NÃO mexe em remuneração — isso vive em collaborator_compensation_settings (migration 040),
--     que continua sendo a fonte única; aqui é só a camada de PESSOAS (cargo/depto/gestor).
--
-- role_key/department_key são texto validado NA APLICAÇÃO contra o catálogo de código
-- (lib/people/catalog.ts) — não são FK (o catálogo não vive no banco).

alter table public.team_members
  add column if not exists role_key        text,
  add column if not exists department_key  text,
  add column if not exists manager_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists joined_at       date,
  add column if not exists status          text not null default 'ativo';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'team_members_status_check') then
    alter table public.team_members
      add constraint team_members_status_check check (status in ('ativo','inativo','afastado','convidado'));
  end if;
end $$;

create index if not exists idx_team_members_role    on public.team_members(team_id, role_key);
create index if not exists idx_team_members_manager on public.team_members(manager_user_id);

-- Popula joined_at das linhas existentes a partir de created_at (determinístico; sem hardcode de id).
update public.team_members set joined_at = created_at::date where joined_at is null;

-- Backfill de cargo do Lucas (Closer/Comercial) foi feito em passo de dados separado (execute_sql),
-- pois referencia um user_id específico — mantido fora da migration versionada por convenção.
