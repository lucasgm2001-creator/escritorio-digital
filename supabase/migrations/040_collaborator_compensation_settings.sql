-- 040_collaborator_compensation_settings.sql
--
-- Configuracao de remuneracao por colaborador/vendedor.
-- Fonte oficial: docs/04-banco-de-dados/remuneracao-colaboradores.md
--
-- Esta migration:
--   * e 100% aditiva e idempotente (pode rodar mais de uma vez sem efeito colateral);
--   * cria apenas a tabela nova collaborator_compensation_settings;
--   * NAO altera tabelas existentes (sellers, seller_salaries, deals,
--     weekly_payments, meetings, client_payments, commissions);
--   * NAO remove nem recria nenhuma tabela;
--   * NAO faz DROP TABLE, TRUNCATE nem apaga dados;
--   * NAO altera comportamento de calculo atual (nenhum codigo runtime le
--     esta tabela ainda);
--   * NAO mexe em RLS/policies nesta etapa (fica para um passo posterior,
--     conforme o plano da doc oficial);
--   * cria a configuracao inicial do Lucas equivalente ao comportamento atual.
--
-- IDs reais preservados (nao recriar / nao trocar):
--   team_id         = 7cf9b5d3-e42f-48d7-bfdf-575736e72827  (DR Growth M.)
--   Lucas seller_id = d129ace7-424b-4434-88af-baa3781cb568  (unico vendedor)
--
-- Comportamento atual espelhado na config inicial do Lucas:
--   salario fixo        = seller_salaries vigente (USD 200 desde 2026-07-01)
--   comissao contrato   = 20% (percentage)        (plans.comissao_percentual; FIN-003)
--   comissao reuniao    = DESABILITADA (FIN-002)  -- Lucas nao recebe mais; meetings segue p/ agenda/historico
--   bonus de renovacao  = inexistente hoje        -> desabilitado
--   comissao de upgrade = inexistente hoje        -> desabilitado
--   regra de pagamento  = semanal conforme o cliente paga

-- ============================================================
-- 1. Tabela collaborator_compensation_settings (aditiva).
--    Versionada por vigencia (seller_id, effective_from).
-- ============================================================
create table if not exists public.collaborator_compensation_settings (
  id                          uuid default gen_random_uuid() primary key,
  team_id                     uuid references public.teams(id)   on delete set null,
  seller_id                   uuid not null references public.sellers(id) on delete restrict,

  -- Salario fixo mensal (USD). Fonte atual continua sendo seller_salaries.
  fixed_salary_enabled        boolean not null default true,
  fixed_salary_monthly_usd    numeric not null default 0,

  -- Comissao por contrato.
  contract_commission_enabled boolean not null default true,
  contract_commission_type    text    not null default 'fixed'
                                 check (contract_commission_type in ('percentage','fixed')),
  contract_commission_value   numeric not null default 0,

  -- Comissao por reuniao.
  meeting_commission_enabled  boolean not null default true,
  meeting_commission_type     text    not null default 'fixed'
                                 check (meeting_commission_type in ('percentage','fixed')),
  meeting_commission_value    numeric not null default 0,

  -- Bonus de renovacao de contrato.
  renewal_bonus_enabled       boolean not null default false,
  renewal_bonus_type          text    not null default 'fixed'
                                 check (renewal_bonus_type in ('percentage','fixed')),
  renewal_bonus_value         numeric not null default 0,

  -- Comissao de upgrade de plano.
  upgrade_commission_enabled  boolean not null default false,
  upgrade_commission_type     text    not null default 'fixed'
                                 check (upgrade_commission_type in ('percentage','fixed')),
  upgrade_commission_value    numeric not null default 0,
  upgrade_commission_base     text    not null default 'plan_difference'
                                 check (upgrade_commission_base in ('full_value','plan_difference')),

  -- Regra de pagamento do colaborador.
  payment_rule                text    not null default 'weekly_as_client_pays'
                                 check (payment_rule in ('weekly_as_client_pays','next_month_after_completion')),

  effective_from              date        not null default current_date,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now(),

  unique (seller_id, effective_from)
);

create index if not exists idx_ccs_team_id
  on public.collaborator_compensation_settings (team_id);
create index if not exists idx_ccs_seller
  on public.collaborator_compensation_settings (seller_id, effective_from);

-- ============================================================
-- 2. Config inicial do Lucas — equivalente ao comportamento atual.
--    Idempotente: so insere se o vendedor existir e ainda nao houver
--    config para essa vigencia. Nunca sobrescreve config existente.
-- ============================================================
insert into public.collaborator_compensation_settings (
  team_id,
  seller_id,
  fixed_salary_enabled,        fixed_salary_monthly_usd,
  contract_commission_enabled, contract_commission_type, contract_commission_value,
  meeting_commission_enabled,  meeting_commission_type,  meeting_commission_value,
  renewal_bonus_enabled,       renewal_bonus_type,       renewal_bonus_value,
  upgrade_commission_enabled,  upgrade_commission_type,  upgrade_commission_value, upgrade_commission_base,
  payment_rule,
  effective_from
)
select
  '7cf9b5d3-e42f-48d7-bfdf-575736e72827'::uuid,  -- team DR Growth M.
  'd129ace7-424b-4434-88af-baa3781cb568'::uuid,  -- Lucas (unico vendedor)
  true,  200,                 -- salario fixo vigente (seller_salaries 2026-07-01)
  true,  'percentage', 20,    -- comissao contrato: 20% do valor semanal do plano (plans.comissao_percentual)
  false, 'fixed', 0,          -- comissao reuniao: DESABILITADA (FIN-002) — value ignorado
  false, 'fixed', 0,          -- bonus de renovacao: desabilitado
  false, 'fixed', 0, 'plan_difference',  -- comissao de upgrade: desabilitada
  'weekly_as_client_pays',    -- paga semanal conforme o cliente paga
  date '2026-07-01'           -- vigencia alinhada ao salario atual
where exists (
  select 1 from public.sellers
  where id = 'd129ace7-424b-4434-88af-baa3781cb568'::uuid
)
on conflict (seller_id, effective_from) do nothing;

-- ============================================================
-- 3. Verificacao manual sugerida apos aplicar
-- ============================================================
-- select * from public.collaborator_compensation_settings
-- where seller_id = 'd129ace7-424b-4434-88af-baa3781cb568';
