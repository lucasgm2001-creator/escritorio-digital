-- 052 ACCESS-ROLES-001: múltiplos cargos por colaborador (FONTE ÚNICA = team_members). Array de CHAVES do
-- catálogo (não texto livre). role_key segue como cargo PRIMÁRIO (= role_keys[0]) p/ compat. Aditivo, sem drops.
-- (profiles.cargo/role/is_manager legados: mantidos no schema por escolha do usuário, mas sem reads no código.)
alter table public.team_members add column if not exists role_keys text[] not null default '{}';
update public.team_members set role_keys = case when role_key is not null then array[role_key] else '{}'::text[] end where role_keys = '{}';
create index if not exists idx_team_members_role_keys on public.team_members using gin(role_keys);
