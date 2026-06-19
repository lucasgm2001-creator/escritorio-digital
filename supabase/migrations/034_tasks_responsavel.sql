-- 034_tasks_responsavel.sql
-- Responsável (vendedor) por tarefa. Idempotente.
-- ⚠️ JÁ aplicada em produção (colunas criadas + todas as tarefas vinculadas ao Lucas) —
--    este arquivo existe só pra o REPO bater com o banco. NÃO precisa rodar nem refazer backfill.
--
-- responsavel_id   → FK p/ sellers (vendedor dono da tarefa; extensível quando houver mais vendedores).
-- responsavel_nome → nome no momento (exibição/relatório sem join).

alter table public.tasks add column if not exists responsavel_id uuid references public.sellers(id) on delete set null;
alter table public.tasks add column if not exists responsavel_nome text;
