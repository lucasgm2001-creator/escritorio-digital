-- 011_role_source_of_truth.sql
-- Idempotente. Consolida a regra de role e aplica colunas que a 010 deveria ter criado.
--
-- Regra final:
--   * profiles.role é a ÚNICA fonte de verdade do papel do usuário.
--   * Novos usuários recebem 'comercial' por padrão.
--   * NUNCA usar raw_user_meta_data->>'role'.
--   * Daniel é admin via profiles.email = 'daniel@drgrowth.com'.

-- ============================================================
-- 1. Garante as colunas opcionais de perfil (migration 010 nunca aplicada)
-- ============================================================
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists cargo      text;
alter table public.profiles add column if not exists logo_url   text;

-- ============================================================
-- 2. Endurece o trigger de criação de perfil
--    Novos usuários SEMPRE 'comercial'; sem ler raw_user_meta_data->>'role'.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'comercial'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 3. Daniel = admin (idempotente; fonte = profiles.email)
-- ============================================================
update public.profiles
set role = 'admin'
where email = 'daniel@drgrowth.com';

-- ============================================================
-- Verificação
-- ============================================================
select email, name, role from public.profiles order by name;
