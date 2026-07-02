-- Versiona policies reais de RLS de equipes exportadas do Supabase de producao.
-- Nao altera comportamento, dados, colunas, funcoes, grants ou codigo da aplicacao.

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;

drop policy if exists team_invites_admin on public.team_invites;
drop policy if exists team_members_admin_manage on public.team_members;
drop policy if exists team_members_select_admin on public.team_members;
drop policy if exists team_members_select_self on public.team_members;
drop policy if exists teams_insert on public.teams;
drop policy if exists teams_select on public.teams;
drop policy if exists teams_update on public.teams;

create policy team_invites_admin
  on public.team_invites
  for all
  to authenticated
  using (user_is_team_admin(team_id))
  with check (user_is_team_admin(team_id));

create policy team_members_admin_manage
  on public.team_members
  for all
  to authenticated
  using (user_is_team_admin(team_id))
  with check (user_is_team_admin(team_id));

create policy team_members_select_admin
  on public.team_members
  for select
  to authenticated
  using (user_is_team_admin(team_id));

create policy team_members_select_self
  on public.team_members
  for select
  to authenticated
  using (user_id = auth.uid());

create policy teams_insert
  on public.teams
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy teams_select
  on public.teams
  for select
  to authenticated
  using (id in (select user_team_ids()));

create policy teams_update
  on public.teams
  for update
  to authenticated
  using (user_is_team_admin(id))
  with check (user_is_team_admin(id));
