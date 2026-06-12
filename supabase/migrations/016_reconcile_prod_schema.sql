-- 016_reconcile_prod_schema.sql
-- RECONCILIAÇÃO de schema: garante que TODAS as colunas que o código atual usa
-- existam em produção. Causa: migrations antigas (006–012) foram aplicadas só
-- parcialmente em prod → "funciona no local, quebra no ar" (já aconteceu com
-- leads.* e agora sellers.cargo / commissions.description).
--
-- 100% idempotente (add column if not exists) e SEGURO: não apaga dados nem
-- colunas, só adiciona o que falta. Pode rodar quantas vezes quiser.

-- ============================================================
-- sellers — cargo (007/008) + campos financeiros (009)
-- ============================================================
alter table public.sellers
  add column if not exists cargo               text,
  add column if not exists monthly_goal        numeric default 0,
  add column if not exists default_commission  numeric default 0,
  add column if not exists fixed_salary        numeric default 0,
  add column if not exists start_date          timestamptz,
  add column if not exists observations        text;

-- ============================================================
-- commissions — cargo + description (usados no insert, nunca migrados)
-- ============================================================
alter table public.commissions
  add column if not exists cargo        text,
  add column if not exists description  text;

-- ============================================================
-- profiles — avatar/telefone/cargo/logo (010/011)
-- ============================================================
alter table public.profiles
  add column if not exists avatar_url  text,
  add column if not exists phone       text,
  add column if not exists cargo       text,
  add column if not exists logo_url    text;

-- ============================================================
-- leads — campos extras (006) — redundante se a 006 já rodou; mantido p/ garantia
-- ============================================================
alter table public.leads
  add column if not exists nicho         text,
  add column if not exists origem        text,
  add column if not exists prioridade    text default 'media',
  add column if not exists next_contact  date;

-- ============================================================
-- Verificação: lista as colunas das 4 tabelas (confira se as acima apareceram)
-- ============================================================
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('sellers', 'commissions', 'profiles', 'leads')
order by table_name, ordinal_position;
