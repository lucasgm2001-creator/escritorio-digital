-- 046_personal_rls_tasks_calendar.sql
--
-- SECURITY-RLS-001 (autorizada). Torna `tasks` e `calendar_events` PESSOAIS na RLS — não só na aplicação.
-- Corrige o P0 do CODE-REVIEW-002: a policy anterior `team_scope` (cmd *) liberava por EQUIPE, então um
-- membro conseguia ler tarefas/agenda de outro pelo client Supabase, driblando o filtro `user_id` da app.
--
-- Regra nova:
--   * membro comum: só os próprios (user_id = auth.uid());
--   * owner/admin: acesso GERENCIAL de toda a equipe (user_is_team_admin cobre role owner|admin);
--   * team_id sempre exigido (team_id IN user_team_ids());
--   * ninguém fora da equipe vê nada.
--
-- Esta migration:
--   * altera SOMENTE policies (substitui `team_scope` por 4 policies por comando em cada tabela);
--   * NÃO toca colunas, NÃO altera dados, NÃO apaga nenhuma linha;
--   * fail-closed: entre o DROP e o CREATE, RLS on sem policy = nega tudo (nunca abre).
--
-- INSERT continua "cria o PRÓPRIO" (todo caminho da app carimba user_id = próprio no servidor; o webhook
-- Magnetic insere via service-role, que ignora RLS). UPDATE/DELETE = próprio (membro) ou toda a equipe (admin),
-- evitando o "vê mas não consegue agir" para o owner. Funções reaproveitadas: user_team_ids(), user_is_team_admin().

-- ── tasks ──
drop policy if exists team_scope on public.tasks;

create policy tasks_select on public.tasks for select
  using (team_id in (select user_team_ids()) and (user_id = auth.uid() or user_is_team_admin(team_id)));

create policy tasks_insert on public.tasks for insert
  with check (team_id in (select user_team_ids()) and user_id = auth.uid());

create policy tasks_update on public.tasks for update
  using (team_id in (select user_team_ids()) and (user_id = auth.uid() or user_is_team_admin(team_id)))
  with check (team_id in (select user_team_ids()) and (user_id = auth.uid() or user_is_team_admin(team_id)));

create policy tasks_delete on public.tasks for delete
  using (team_id in (select user_team_ids()) and (user_id = auth.uid() or user_is_team_admin(team_id)));

-- ── calendar_events ──
drop policy if exists team_scope on public.calendar_events;

create policy calendar_select on public.calendar_events for select
  using (team_id in (select user_team_ids()) and (user_id = auth.uid() or user_is_team_admin(team_id)));

create policy calendar_insert on public.calendar_events for insert
  with check (team_id in (select user_team_ids()) and user_id = auth.uid());

create policy calendar_update on public.calendar_events for update
  using (team_id in (select user_team_ids()) and (user_id = auth.uid() or user_is_team_admin(team_id)))
  with check (team_id in (select user_team_ids()) and (user_id = auth.uid() or user_is_team_admin(team_id)));

create policy calendar_delete on public.calendar_events for delete
  using (team_id in (select user_team_ids()) and (user_id = auth.uid() or user_is_team_admin(team_id)));
