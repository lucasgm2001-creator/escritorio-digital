-- 032_negocio_futuro.sql
-- Adiciona a fase "Negócio Futuro" ao funil configurável (funnel_stages, criada em 028),
-- na posição 10 (logo APÓS "Venda Perdida" e ANTES de "Lixeira"), e estende a CHECK de
-- leads.status pra aceitar o novo slug.
--
-- IDEMPOTENTE: pode rodar mais de uma vez sem quebrar (será aplicada via MCP).
-- NÃO mexe em dinheiro: a fase nasce NEUTRA (is_won/is_lost/is_system = false), então o
-- won-flow/comissão NÃO dispara — o gatilho é a FLAG is_won da fase, não o slug.

-- 1) Abre espaço: move "Lixeira" de 10 → 11. Guarda (posicao = 10) torna idempotente:
--    se já estiver em 11 (re-execução), não faz nada.
update public.funnel_stages
   set posicao = 11
 where slug = 'lixeira' and posicao = 10;

-- 2) Cria a fase "Negócio Futuro" na posição 10. conta_interagiu = true (entra como
--    "interagiu" no relatório); reunião/fechou = false. slug é UNIQUE (028) →
--    ON CONFLICT (slug) DO NOTHING evita duplicar em re-execução.
insert into public.funnel_stages
  (slug, nome, posicao, is_won, is_lost, is_system, conta_interagiu, conta_reuniao, conta_fechou, arquivada)
values
  ('negocio_futuro', 'Negócio Futuro', 10, false, false, false, true, false, false, false)
on conflict (slug) do nothing;

-- 3) Estende a CHECK de leads.status pra aceitar 'negocio_futuro'. DROP IF EXISTS antes do
--    ADD deixa idempotente. Conjunto final = as 10 fases de hoje + 'negocio_futuro'.
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('novo','interagiu','nao_interagiu','reuniao','no_show','reagendamento','proposta','fechado','perdido','lixeira','negocio_futuro'));
