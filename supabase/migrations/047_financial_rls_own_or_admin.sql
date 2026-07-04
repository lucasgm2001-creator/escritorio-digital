-- 047_financial_rls_own_or_admin.sql
--
-- COMPENSATION-REAL-002 / SECURITY-RLS-002 (autorizada). Fecha nas tabelas FINANCEIRAS a MESMA brecha
-- corrigida em Tasks/Agenda (migration 046): a policy `team_scope` liberava por EQUIPE, então um membro
-- conseguia ler salário/comissão de OUTRO vendedor pelo client Supabase.
--
-- Regra nova:
--   * LEITURA (SELECT): apenas o PRÓPRIO vendedor (sellers.user_id = auth.uid()) OU admin/owner da equipe;
--   * INSERT/UPDATE/DELETE: seguem team-scoped — NÃO se toca no won-flow / escrita de comissão (Parte 7).
--   * sellers e fx_config seguem team-scoped (nomes p/ dropdowns e câmbio; o dinheiro sensível está aqui).
--
-- Bônus: collaborator_compensation_settings tinha RLS ON e ZERO policy (deny-all) — o "modelo" não carregava
-- nem para o dono. Ganha policy own-or-admin (leitura) + admin (escrita), destravando a visão do colaborador.
--
-- SÓ policies + 1 função helper. Nenhuma tabela/coluna/dado/linha tocada. Fail-closed entre drop e create.

create or replace function public.user_seller_ids()
  returns setof uuid language sql stable security definer set search_path to 'public'
as $$ select id from public.sellers where user_id = auth.uid() $$;

-- ── seller_salaries / deals / meetings (têm seller_id) ──
drop policy if exists team_scope on public.seller_salaries;
create policy seller_salaries_select on public.seller_salaries for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id) or seller_id in (select user_seller_ids())));
create policy seller_salaries_insert on public.seller_salaries for insert with check (team_id in (select user_team_ids()));
create policy seller_salaries_update on public.seller_salaries for update using (team_id in (select user_team_ids())) with check (team_id in (select user_team_ids()));
create policy seller_salaries_delete on public.seller_salaries for delete using (team_id in (select user_team_ids()));

drop policy if exists team_scope on public.deals;
create policy deals_select on public.deals for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id) or seller_id in (select user_seller_ids())));
create policy deals_insert on public.deals for insert with check (team_id in (select user_team_ids()));
create policy deals_update on public.deals for update using (team_id in (select user_team_ids())) with check (team_id in (select user_team_ids()));
create policy deals_delete on public.deals for delete using (team_id in (select user_team_ids()));

drop policy if exists team_scope on public.meetings;
create policy meetings_select on public.meetings for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id) or seller_id in (select user_seller_ids())));
create policy meetings_insert on public.meetings for insert with check (team_id in (select user_team_ids()));
create policy meetings_update on public.meetings for update using (team_id in (select user_team_ids())) with check (team_id in (select user_team_ids()));
create policy meetings_delete on public.meetings for delete using (team_id in (select user_team_ids()));

-- ── weekly_payments (SEM seller_id → via deal) ──
drop policy if exists team_scope on public.weekly_payments;
create policy weekly_payments_select on public.weekly_payments for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id)
    or deal_id in (select id from public.deals where seller_id in (select user_seller_ids()))));
create policy weekly_payments_insert on public.weekly_payments for insert with check (team_id in (select user_team_ids()));
create policy weekly_payments_update on public.weekly_payments for update using (team_id in (select user_team_ids())) with check (team_id in (select user_team_ids()));
create policy weekly_payments_delete on public.weekly_payments for delete using (team_id in (select user_team_ids()));

-- ── collaborator_compensation_settings (tinha RLS ON e ZERO policy) ──
create policy ccs_select on public.collaborator_compensation_settings for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id) or seller_id in (select user_seller_ids())));
create policy ccs_write on public.collaborator_compensation_settings for insert with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id));
create policy ccs_update on public.collaborator_compensation_settings for update using (team_id in (select user_team_ids()) and user_is_team_admin(team_id)) with check (team_id in (select user_team_ids()) and user_is_team_admin(team_id));
create policy ccs_delete on public.collaborator_compensation_settings for delete using (team_id in (select user_team_ids()) and user_is_team_admin(team_id));
