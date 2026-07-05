-- 051 F4 — Soft delete GLOBAL (owner-only, reversível, auditável). PROPOSTA — revisar antes de aplicar.
-- Excluído some de TODA leitura autenticada via RLS (fonte única) — inclui a comissão (escolha do usuário
-- CLIENT-DOMAIN-003: cliente excluído some inteiro, inclusive Minha Remuneração/PDF; restaurar reverte).
-- NÃO apaga fisicamente (soft). Cascata + restore + definitivo via RPCs SECURITY DEFINER OWNER-ONLY.
-- Service-role (crons/APIs/IA) filtram deleted_at no CÓDIGO (ignoram RLS). Aditivo; nenhuma regra de dinheiro
-- muda (comissão só é OCULTADA por escopo de leitura; valores no banco intactos; restaurar traz idêntico).

-- ── 1) Marcadores (deleted_at/deleted_by) nas 8 tabelas ─────────────────────────────────────────
alter table public.leads             add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;
alter table public.clients           add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;
alter table public.deals             add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;
alter table public.weekly_payments   add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;
alter table public.client_payments   add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;
alter table public.meetings          add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;
alter table public.lead_interactions add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;
alter table public.activities        add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;

create index if not exists idx_leads_live            on public.leads(team_id)          where deleted_at is null;
create index if not exists idx_clients_live          on public.clients(team_id)        where deleted_at is null;
create index if not exists idx_deals_live            on public.deals(client_id)        where deleted_at is null;
create index if not exists idx_weekly_payments_live  on public.weekly_payments(deal_id) where deleted_at is null;
create index if not exists idx_client_payments_live  on public.client_payments(client_id) where deleted_at is null;
create index if not exists idx_meetings_live         on public.meetings(seller_id)     where deleted_at is null;

-- ── 2) RLS = fonte única (add "deleted_at IS NULL") ─────────────────────────────────────────────
-- 2a) tabelas com team_scope FOR ALL: USING+WITH CHECK ganham deleted_at IS NULL (só RPC seta/limpa).
do $$ declare t text; begin
  foreach t in array array['leads','clients','client_payments','lead_interactions','activities'] loop
    execute format('drop policy if exists team_scope on public.%I', t);
    execute format($f$create policy team_scope on public.%I for all
      using (team_id in (select user_team_ids()) and deleted_at is null)
      with check (team_id in (select user_team_ids()) and deleted_at is null)$f$, t);
  end loop;
end $$;

-- 2b) tabelas financeiras (SELECT own-or-admin): add deleted_at IS NULL no SELECT; UPDATE não pode setar deleted_at.
drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id) or seller_id in (select user_seller_ids())) and deleted_at is null);
drop policy if exists deals_update on public.deals;
create policy deals_update on public.deals for update
  using (team_id in (select user_team_ids())) with check (team_id in (select user_team_ids()) and deleted_at is null);

drop policy if exists weekly_payments_select on public.weekly_payments;
create policy weekly_payments_select on public.weekly_payments for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id) or deal_id in (select deals.id from deals where deals.seller_id in (select user_seller_ids()))) and deleted_at is null);
drop policy if exists weekly_payments_update on public.weekly_payments;
create policy weekly_payments_update on public.weekly_payments for update
  using (team_id in (select user_team_ids())) with check (team_id in (select user_team_ids()) and deleted_at is null);

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings for select
  using (team_id in (select user_team_ids()) and (user_is_team_admin(team_id) or seller_id in (select user_seller_ids())) and deleted_at is null);
drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings for update
  using (team_id in (select user_team_ids())) with check (team_id in (select user_team_ids()) and deleted_at is null);

-- ── 3) RPCs SECURITY DEFINER, OWNER-ONLY, cascata/reversível/auditável ──────────────────────────
create or replace function public.require_owner(p_team uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_role text;
begin
  if p_team is null then raise exception 'registro sem equipe'; end if;
  select role into v_role from team_members where user_id = auth.uid() and team_id = p_team;
  if v_role is distinct from 'owner' then raise exception 'apenas o owner da equipe pode excluir/restaurar'; end if;
end $$;

create or replace function public.soft_delete_client(p_client_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_team uuid; begin
  select team_id into v_team from clients where id = p_client_id;
  perform require_owner(v_team);
  update clients          set deleted_at=now(), deleted_by=auth.uid() where id=p_client_id and deleted_at is null;
  update deals            set deleted_at=now(), deleted_by=auth.uid() where client_id=p_client_id and deleted_at is null;
  update weekly_payments  set deleted_at=now(), deleted_by=auth.uid() where deal_id in (select id from deals where client_id=p_client_id) and deleted_at is null;
  update client_payments  set deleted_at=now(), deleted_by=auth.uid() where client_id=p_client_id and deleted_at is null;
  update meetings         set deleted_at=now(), deleted_by=auth.uid() where client_id=p_client_id and deleted_at is null;
  update activities       set deleted_at=now(), deleted_by=auth.uid() where entity_id=p_client_id and deleted_at is null;
end $$;

create or replace function public.soft_delete_lead(p_lead_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_team uuid; begin
  select team_id into v_team from leads where id = p_lead_id;
  perform require_owner(v_team);
  update leads             set deleted_at=now(), deleted_by=auth.uid() where id=p_lead_id and deleted_at is null;
  update lead_interactions set deleted_at=now(), deleted_by=auth.uid() where lead_id=p_lead_id and deleted_at is null;
  update meetings          set deleted_at=now(), deleted_by=auth.uid() where lead_id=p_lead_id and deleted_at is null;
  update deals             set deleted_at=now(), deleted_by=auth.uid() where lead_id=p_lead_id and deleted_at is null;
  update weekly_payments   set deleted_at=now(), deleted_by=auth.uid() where deal_id in (select id from deals where lead_id=p_lead_id) and deleted_at is null;
  update activities        set deleted_at=now(), deleted_by=auth.uid() where entity_id=p_lead_id and deleted_at is null;
end $$;

create or replace function public.restore_client(p_client_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_team uuid; begin
  select team_id into v_team from clients where id = p_client_id;
  perform require_owner(v_team);
  update clients          set deleted_at=null, deleted_by=null where id=p_client_id;
  update deals            set deleted_at=null, deleted_by=null where client_id=p_client_id;
  update weekly_payments  set deleted_at=null, deleted_by=null where deal_id in (select id from deals where client_id=p_client_id);
  update client_payments  set deleted_at=null, deleted_by=null where client_id=p_client_id;
  update meetings         set deleted_at=null, deleted_by=null where client_id=p_client_id;
  update activities       set deleted_at=null, deleted_by=null where entity_id=p_client_id;
end $$;

create or replace function public.restore_lead(p_lead_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_team uuid; begin
  select team_id into v_team from leads where id = p_lead_id;
  perform require_owner(v_team);
  update leads             set deleted_at=null, deleted_by=null where id=p_lead_id;
  update lead_interactions set deleted_at=null, deleted_by=null where lead_id=p_lead_id;
  update meetings          set deleted_at=null, deleted_by=null where lead_id=p_lead_id;
  update deals             set deleted_at=null, deleted_by=null where lead_id=p_lead_id;
  update weekly_payments   set deleted_at=null, deleted_by=null where deal_id in (select id from deals where lead_id=p_lead_id);
  update activities        set deleted_at=null, deleted_by=null where entity_id=p_lead_id;
end $$;

-- Exclusão DEFINITIVA (física) — owner-only, ordem FK-safe. Preferir soft; usar só quando exigido.
create or replace function public.hard_delete_client(p_client_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_team uuid; begin
  select team_id into v_team from clients where id = p_client_id;
  perform require_owner(v_team);
  delete from weekly_payments where deal_id in (select id from deals where client_id=p_client_id);
  delete from client_payments where client_id=p_client_id;
  delete from meetings where client_id=p_client_id;
  delete from plan_changes where client_id=p_client_id;
  delete from deals where client_id=p_client_id;
  delete from activities where entity_id=p_client_id;
  delete from clients where id=p_client_id;
end $$;

create or replace function public.hard_delete_lead(p_lead_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_team uuid; begin
  select team_id into v_team from leads where id = p_lead_id;
  perform require_owner(v_team);
  delete from weekly_payments where deal_id in (select id from deals where lead_id=p_lead_id);
  delete from meetings where lead_id=p_lead_id;
  delete from deals where lead_id=p_lead_id;
  delete from lead_interactions where lead_id=p_lead_id;
  delete from activities where entity_id=p_lead_id;
  delete from leads where id=p_lead_id;
end $$;

-- ── 4) Lixeira (owner-only): lista os excluídos (SECURITY DEFINER = único caminho que enxerga deleted) ──
create or replace function public.list_deleted_clients() returns setof public.clients
language plpgsql security definer set search_path to 'public' stable as $$
begin
  return query select c.* from public.clients c where c.deleted_at is not null
    and exists (select 1 from team_members tm where tm.user_id=auth.uid() and tm.team_id=c.team_id and tm.role='owner')
    order by c.deleted_at desc;
end $$;

create or replace function public.list_deleted_leads() returns setof public.leads
language plpgsql security definer set search_path to 'public' stable as $$
begin
  return query select l.* from public.leads l where l.deleted_at is not null
    and exists (select 1 from team_members tm where tm.user_id=auth.uid() and tm.team_id=l.team_id and tm.role='owner')
    order by l.deleted_at desc;
end $$;

-- ── 5) Unificação da lixeira antiga: status='lixeira' PASSA a ser exclusão (deleted_at). deleted_at vira a
--        fonte oficial. status fica no histórico; a RLS agora esconde por deleted_at (não mais por 'lixeira'). ──
update public.leads set deleted_at = now() where status = 'lixeira' and deleted_at is null;

-- ── 6) Grants: só autenticado chama; o gate real é require_owner / o exists de owner (só o owner passa). ──
revoke all on function public.soft_delete_client(uuid), public.soft_delete_lead(uuid),
  public.restore_client(uuid), public.restore_lead(uuid),
  public.hard_delete_client(uuid), public.hard_delete_lead(uuid), public.require_owner(uuid),
  public.list_deleted_clients(), public.list_deleted_leads() from public;
grant execute on function public.soft_delete_client(uuid), public.soft_delete_lead(uuid),
  public.restore_client(uuid), public.restore_lead(uuid),
  public.hard_delete_client(uuid), public.hard_delete_lead(uuid),
  public.list_deleted_clients(), public.list_deleted_leads() to authenticated;
