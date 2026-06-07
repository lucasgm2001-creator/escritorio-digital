-- 012_sellers_commissions_admin_write.sql
-- Endurece a ESCRITA em sellers e commissions: apenas admin pode INSERT/UPDATE.
-- Antes, as policies usavam só auth.role() = 'authenticated', então qualquer
-- usuário logado inseria/editava vendedores e comissões via API (a UI escondia
-- o botão, mas a API não barrava).
--
-- SELECT continua liberado para qualquer autenticado (todos precisam ler).
-- DELETE permanece sem policy (bloqueado por RLS) como antes.
-- Idempotente: pode rodar mais de uma vez.

-- ============================================================
-- sellers
-- ============================================================
alter table public.sellers enable row level security;

drop policy if exists "Auth insere sellers"    on public.sellers;
drop policy if exists "Auth atualiza sellers"   on public.sellers;
drop policy if exists "Admin insere sellers"    on public.sellers;
drop policy if exists "Admin atualiza sellers"  on public.sellers;

create policy "Admin insere sellers" on public.sellers
  for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin atualiza sellers" on public.sellers
  for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Leitura inalterada (recriada idempotente para não quebrar o SELECT existente).
drop policy if exists "Auth lê sellers" on public.sellers;
create policy "Auth lê sellers" on public.sellers
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- commissions
-- ============================================================
alter table public.commissions enable row level security;

drop policy if exists "Auth insere commissions"    on public.commissions;
drop policy if exists "Auth atualiza commissions"   on public.commissions;
drop policy if exists "Admin insere commissions"    on public.commissions;
drop policy if exists "Admin atualiza commissions"  on public.commissions;

create policy "Admin insere commissions" on public.commissions
  for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin atualiza commissions" on public.commissions
  for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Leitura inalterada (recriada idempotente).
drop policy if exists "Auth lê commissions" on public.commissions;
create policy "Auth lê commissions" on public.commissions
  for select using (auth.role() = 'authenticated');
