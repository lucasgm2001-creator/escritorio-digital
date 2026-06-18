-- 024_studio_bloco4.sql  (PARA REVISÃO — NÃO RODADO)
-- Studio Bloco 4: organização da biblioteca de materiais — favoritos, pastas e nicho.
-- Idempotente. Single-user → colunas simples (sem tabelas novas). NÃO mexe em clients.

alter table public.presentation_materials add column if not exists favorito boolean not null default false;
alter table public.presentation_materials add column if not exists pasta text;
alter table public.presentation_materials add column if not exists nicho text;

create index if not exists idx_pm_favorito on public.presentation_materials(favorito) where favorito;
create index if not exists idx_pm_pasta   on public.presentation_materials(pasta);
create index if not exists idx_pm_nicho   on public.presentation_materials(nicho);

-- (RLS não muda: a tabela já tem políticas 'authenticated' em select/insert/delete.)
