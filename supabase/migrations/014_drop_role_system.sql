-- 014_drop_role_system.sql
-- Pivot para app PESSOAL de usuário único (Lucas). Remove o RLS baseado em
-- PAPEL (admin/comercial/trafego/financeiro) criado nas migrations 012 e 013.
--
-- O QUE SAI (apenas a parte de "qual papel"):
--   * profiles: policy "Admin lê todos" + função is_admin() (013).
--   * sellers/commissions: writes admin-only (012) → viram authenticated-only.
--
-- O QUE FICA (privacidade — só o usuário autenticado acessa seus dados):
--   * profiles: "Usuário lê próprio perfil" e "Usuário atualiza próprio perfil"
--     (auth.uid() = id). Garantem que cada conta só enxerga a própria linha.
--   * SELECT em sellers/commissions continua liberado para autenticados.
--
-- NÃO removemos a COLUNA profiles.role (decisão: manter para não quebrar o
-- trigger handle_new_user nem queries, e facilitar rollback). Ela apenas deixa
-- de ser lida pelo app e de gatekeeper de acesso.
--
-- Idempotente: pode rodar mais de uma vez.

-- ============================================================
-- 1. profiles — remove a leitura "de admin" (e a função que ela usava)
-- ============================================================
-- A policy "Usuário lê próprio perfil" (auth.uid() = id) permanece e é
-- suficiente: com um único usuário, ler a própria linha cobre tudo.
drop policy if exists "Admin lê todos" on public.profiles;
drop function if exists public.is_admin();

-- ============================================================
-- 2. sellers — write de admin → authenticated
-- ============================================================
alter table public.sellers enable row level security;

drop policy if exists "Admin insere sellers"   on public.sellers;
drop policy if exists "Admin atualiza sellers"  on public.sellers;
drop policy if exists "Auth insere sellers"     on public.sellers;
drop policy if exists "Auth atualiza sellers"   on public.sellers;

create policy "Auth insere sellers"   on public.sellers
  for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza sellers" on public.sellers
  for update using (auth.role() = 'authenticated')
              with check (auth.role() = 'authenticated');

-- SELECT inalterado (recriado idempotente).
drop policy if exists "Auth lê sellers" on public.sellers;
create policy "Auth lê sellers" on public.sellers
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- 3. commissions — write de admin → authenticated
-- ============================================================
alter table public.commissions enable row level security;

drop policy if exists "Admin insere commissions"   on public.commissions;
drop policy if exists "Admin atualiza commissions"  on public.commissions;
drop policy if exists "Auth insere commissions"     on public.commissions;
drop policy if exists "Auth atualiza commissions"   on public.commissions;

create policy "Auth insere commissions"   on public.commissions
  for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza commissions" on public.commissions
  for update using (auth.role() = 'authenticated')
              with check (auth.role() = 'authenticated');

-- SELECT inalterado (recriado idempotente).
drop policy if exists "Auth lê commissions" on public.commissions;
create policy "Auth lê commissions" on public.commissions
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- 4. notices — remove o insert "admin/gestor" (migration 002)
-- ============================================================
-- Era a única outra policy baseada em profiles.role fora de 012/013. Já era
-- redundante (a policy "Auth insere notices" da 005 libera authenticated, e
-- policies permissivas são OR), mas é papel — então sai. Garantimos o insert
-- authenticated abaixo, para o caso de só a policy de admin existir no banco.
alter table public.notices enable row level security;

drop policy if exists "Admin e gestor inserem avisos" on public.notices;
drop policy if exists "Auth insere notices"            on public.notices;
create policy "Auth insere notices" on public.notices
  for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- Verificação: lista as policies restantes. Nenhuma deve mencionar a COLUNA
-- profiles.role nem is_admin() (as que citam auth.role()='authenticated' são
-- privacidade e devem permanecer). profiles deve manter apenas as duas de
-- "próprio perfil".
-- ============================================================
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'sellers', 'commissions', 'notices')
order by tablename, policyname;
