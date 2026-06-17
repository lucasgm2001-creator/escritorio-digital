-- 022_leads_default_eua.sql
-- Remove a segmentação Brasil/EUA na prática: todo lead passa a ser EUA.
-- NÃO derruba a coluna `operation` (preserva histórico e compatibilidade); apenas
-- converte os registros existentes e muda o default para 'eua'.
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.

-- 1) Converte leads existentes marcados como Brasil (ou qualquer valor != 'eua') → EUA.
update public.leads
  set operation = 'eua'
  where operation is distinct from 'eua';

-- 2) Novos leads nascem 'eua' por padrão (antes era 'brasil').
alter table public.leads
  alter column operation set default 'eua';

-- Obs: a CHECK constraint operation in ('brasil','eua') é mantida de propósito
-- (não há mais linhas 'brasil', e manter a checagem não atrapalha).
