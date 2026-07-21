-- SECURITY-HARDENING-001
-- Defesa em profundidade para autorização granular, Storage e RPCs expostos.

-- ---------------------------------------------------------------------------
-- 1. Autoridade granular por módulo, reutilizada pelas policies RLS.
-- ---------------------------------------------------------------------------
create or replace function public.user_has_module_level(
  p_team uuid,
  p_module text,
  p_required text default 'read'
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.team_members tm
     where tm.team_id = p_team
       and tm.user_id = auth.uid()
       and case
         when tm.role in ('owner', 'admin') then true
         when tm.role = 'member' then
           case coalesce(tm.permissions #>> array['modules', p_module], 'read')
             when 'admin' then 3
             when 'edit' then 2
             when 'read' then 1
             else 0
           end >= case p_required
             when 'admin' then 3
             when 'edit' then 2
             when 'read' then 1
             else 99
           end
         else false
       end
  )
$$;

create or replace function public.user_is_any_team_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
     where user_id = auth.uid() and role = 'owner'
  )
$$;

revoke all on function public.user_has_module_level(uuid, text, text) from public, anon, authenticated;
revoke all on function public.user_is_any_team_owner() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Remove policies permissivas antigas e recria por operação/nível.
--    Policies são OR por padrão: manter uma ALL antiga anularia as novas.
-- ---------------------------------------------------------------------------
drop policy if exists team_scope on public.fx_config;
drop policy if exists team_scope on public.plans;

drop policy if exists team_scope on public.activities;
create policy activities_select on public.activities for select to authenticated
  using (team_id in (select public.user_team_ids()) and deleted_at is null);
create policy activities_insert on public.activities for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null);
create policy activities_update on public.activities for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null)
  with check (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null);
create policy activities_delete on public.activities for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null);

drop policy if exists team_scope on public.calls;
create policy calls_select on public.calls for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy calls_insert on public.calls for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy calls_update on public.calls for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'))
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy calls_delete on public.calls for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'));

drop policy if exists team_scope on public.client_integrations;
create policy client_integrations_select on public.client_integrations for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy client_integrations_insert on public.client_integrations for insert to authenticated
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));
create policy client_integrations_update on public.client_integrations for update to authenticated
  using (public.user_has_module_level(team_id, 'clientes', 'edit'))
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));
create policy client_integrations_delete on public.client_integrations for delete to authenticated
  using (public.user_has_module_level(team_id, 'clientes', 'edit'));

drop policy if exists team_scope on public.clients;
create policy clients_select on public.clients for select to authenticated
  using (team_id in (select public.user_team_ids()) and deleted_at is null);
create policy clients_insert on public.clients for insert to authenticated
  with check (public.user_has_module_level(team_id, 'clientes', 'edit') and deleted_at is null);
create policy clients_update on public.clients for update to authenticated
  using (public.user_has_module_level(team_id, 'clientes', 'edit') and deleted_at is null)
  with check (public.user_has_module_level(team_id, 'clientes', 'edit') and deleted_at is null);
create policy clients_delete on public.clients for delete to authenticated
  using (public.user_has_module_level(team_id, 'clientes', 'edit') and deleted_at is null);

drop policy if exists team_scope on public.funnel_stages;
create policy funnel_stages_select on public.funnel_stages for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy funnel_stages_insert on public.funnel_stages for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'admin'));
create policy funnel_stages_update on public.funnel_stages for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'admin'))
  with check (public.user_has_module_level(team_id, 'comercial', 'admin'));
create policy funnel_stages_delete on public.funnel_stages for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'admin'));

drop policy if exists team_scope on public.lead_interactions;
create policy lead_interactions_select on public.lead_interactions for select to authenticated
  using (team_id in (select public.user_team_ids()) and deleted_at is null);
create policy lead_interactions_insert on public.lead_interactions for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null);
create policy lead_interactions_update on public.lead_interactions for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null)
  with check (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null);
create policy lead_interactions_delete on public.lead_interactions for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null);

drop policy if exists team_scope on public.lead_milestones;
create policy lead_milestones_select on public.lead_milestones for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy lead_milestones_insert on public.lead_milestones for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy lead_milestones_update on public.lead_milestones for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'))
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy lead_milestones_delete on public.lead_milestones for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'));

drop policy if exists team_scope on public.leads;
create policy leads_select on public.leads for select to authenticated
  using (team_id in (select public.user_team_ids()) and deleted_at is null);
create policy leads_insert on public.leads for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null);
create policy leads_update on public.leads for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null)
  with check (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null);
create policy leads_delete on public.leads for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit') and deleted_at is null);

drop policy if exists team_scope on public.nichos;
create policy nichos_select on public.nichos for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy nichos_insert on public.nichos for insert to authenticated
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));
create policy nichos_update on public.nichos for update to authenticated
  using (public.user_has_module_level(team_id, 'clientes', 'edit'))
  with check (public.user_has_module_level(team_id, 'clientes', 'edit'));
create policy nichos_delete on public.nichos for delete to authenticated
  using (public.user_has_module_level(team_id, 'clientes', 'edit'));

drop policy if exists team_scope on public.presentation_materials;
create policy presentation_materials_select on public.presentation_materials for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy presentation_materials_insert on public.presentation_materials for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy presentation_materials_update on public.presentation_materials for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'))
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy presentation_materials_delete on public.presentation_materials for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'));

drop policy if exists team_scope on public.presentations;
create policy presentations_select on public.presentations for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy presentations_insert on public.presentations for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy presentations_update on public.presentations for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'))
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy presentations_delete on public.presentations for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'));

drop policy if exists team_scope on public.sellers;
create policy sellers_select on public.sellers for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy sellers_insert on public.sellers for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'admin'));
create policy sellers_update on public.sellers for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'admin'))
  with check (public.user_has_module_level(team_id, 'comercial', 'admin'));
create policy sellers_delete on public.sellers for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'admin'));

drop policy if exists team_scope on public.seller_comp_config;
create policy seller_comp_config_select on public.seller_comp_config for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy seller_comp_config_insert on public.seller_comp_config for insert to authenticated
  with check (public.user_has_module_level(team_id, 'financeiro', 'admin'));
create policy seller_comp_config_update on public.seller_comp_config for update to authenticated
  using (public.user_has_module_level(team_id, 'financeiro', 'admin'))
  with check (public.user_has_module_level(team_id, 'financeiro', 'admin'));
create policy seller_comp_config_delete on public.seller_comp_config for delete to authenticated
  using (public.user_has_module_level(team_id, 'financeiro', 'admin'));

drop policy if exists team_scope on public.stage_events;
create policy stage_events_select on public.stage_events for select to authenticated
  using (team_id in (select public.user_team_ids()));
create policy stage_events_insert on public.stage_events for insert to authenticated
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy stage_events_update on public.stage_events for update to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'))
  with check (public.user_has_module_level(team_id, 'comercial', 'edit'));
create policy stage_events_delete on public.stage_events for delete to authenticated
  using (public.user_has_module_level(team_id, 'comercial', 'edit'));

-- Notícias e avisos são gravados apenas por rotinas internas/service-role.
drop policy if exists team_scope on public.news;
create policy news_select on public.news for select to authenticated
  using (team_id in (select public.user_team_ids()));
drop policy if exists team_scope on public.notices;
create policy notices_select on public.notices for select to authenticated
  using (team_id in (select public.user_team_ids()));

-- Um usuário só pode atualizar campos públicos e não privilegiados do próprio perfil.
revoke update on table public.profiles from anon, authenticated;
grant update (name, avatar_url, phone, logo_url, call_link) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Storage: impede overwrite/delete/listagem entre usuários e equipes.
--    Buckets continuam públicos para URLs já salvas; SELECT amplo não é necessário.
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 1048576,
       allowed_mime_types = array['image/jpeg']::text[]
 where id in ('avatars', 'assets');

update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array[
         'application/pdf',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'image/jpeg', 'image/png', 'image/gif', 'image/webp'
       ]::text[]
 where id = 'materiais';

drop policy if exists "Public read assets" on storage.objects;
drop policy if exists "Authenticated upload assets" on storage.objects;
drop policy if exists "Authenticated update assets" on storage.objects;
drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "Authenticated upload avatars" on storage.objects;
drop policy if exists "Authenticated update avatars" on storage.objects;
drop policy if exists "materiais leitura" on storage.objects;
drop policy if exists "materiais upload logado" on storage.objects;
drop policy if exists "materiais excluir logado" on storage.objects;

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy assets_insert_authorized on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assets' and (
      (name = 'site-logo/logo.jpg' and public.user_is_any_team_owner()) or
      exists (
        select 1 from public.sellers s
         where name = 'sellers/' || s.id::text || '.jpg'
           and public.user_has_module_level(s.team_id, 'comercial', 'admin')
      )
    )
  );
create policy assets_update_authorized on storage.objects for update to authenticated
  using (
    bucket_id = 'assets' and (
      (name = 'site-logo/logo.jpg' and public.user_is_any_team_owner()) or
      exists (
        select 1 from public.sellers s
         where name = 'sellers/' || s.id::text || '.jpg'
           and public.user_has_module_level(s.team_id, 'comercial', 'admin')
      )
    )
  )
  with check (
    bucket_id = 'assets' and (
      (name = 'site-logo/logo.jpg' and public.user_is_any_team_owner()) or
      exists (
        select 1 from public.sellers s
         where name = 'sellers/' || s.id::text || '.jpg'
           and public.user_has_module_level(s.team_id, 'comercial', 'admin')
      )
    )
  );

create policy materiais_insert_team on storage.objects for insert to authenticated
  with check (
    bucket_id = 'materiais'
    and (storage.foldername(name))[1] in (select public.user_team_ids()::text)
    and public.user_has_module_level(((storage.foldername(name))[1])::uuid, 'comercial', 'edit')
  );
create policy materiais_delete_team on storage.objects for delete to authenticated
  using (
    bucket_id = 'materiais'
    and (storage.foldername(name))[1] in (select public.user_team_ids()::text)
    and public.user_has_module_level(((storage.foldername(name))[1])::uuid, 'comercial', 'edit')
  );

-- ---------------------------------------------------------------------------
-- 4. Rate limit distribuído. Não depende da memória de uma instância Vercel.
-- ---------------------------------------------------------------------------
create table if not exists public.security_rate_limits (
  key_hash text primary key,
  request_count integer not null,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.security_rate_limits enable row level security;
revoke all on table public.security_rate_limits from public, anon, authenticated;

create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_reset timestamptz;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$'
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.security_rate_limits (key_hash, request_count, reset_at, updated_at)
  values (p_key_hash, 1, now() + make_interval(secs => p_window_seconds), now())
  on conflict (key_hash) do update
    set request_count = case
          when security_rate_limits.reset_at <= now() then 1
          else security_rate_limits.request_count + 1
        end,
        reset_at = case
          when security_rate_limits.reset_at <= now()
            then now() + make_interval(secs => p_window_seconds)
          else security_rate_limits.reset_at
        end,
        updated_at = now()
  returning request_count, reset_at into v_count, v_reset;

  -- Limpeza oportunista e limitada a janelas antigas; não contém dados pessoais.
  delete from public.security_rate_limits
   where reset_at < now() - interval '1 day';

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(0, p_limit - v_count),
    'reset_at', v_reset
  );
end
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. RPCs SECURITY DEFINER: nenhum acesso anônimo e execução mínima necessária.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon', f.proname, f.args);
  end loop;
end $$;

-- Funções internas/trigger/RLS nunca devem aparecer como RPC de usuário.
revoke execute on function public.assign_lead_contact_code() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.process_due_renewals(date) from authenticated;
revoke execute on function public.require_owner(uuid) from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.set_billing_anchor_from_first_payment() from authenticated;
revoke execute on function public.set_team_id_default() from authenticated;
revoke execute on function public.sync_upgrade_installments_from_payment() from authenticated;
revoke execute on function public.track_client_assignment() from authenticated;
revoke execute on function public.user_is_team_admin(uuid) from authenticated;
revoke execute on function public.user_seller_ids() from authenticated;
revoke execute on function public.user_team_ids() from authenticated;
revoke execute on function public.validate_lead_status() from authenticated;

grant execute on function public.process_due_renewals(date) to service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- RPCs de produto continuam autenticadas; cada uma valida auth.uid/equipe internamente.
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.create_invite(uuid, text, integer, text) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.hard_delete_client(uuid) to authenticated;
grant execute on function public.hard_delete_lead(uuid) to authenticated;
grant execute on function public.list_deleted_clients() to authenticated;
grant execute on function public.list_deleted_leads() to authenticated;
grant execute on function public.register_plan_upgrade_v2(uuid, uuid, date, uuid, integer, text) to authenticated;
grant execute on function public.restore_client(uuid) to authenticated;
grant execute on function public.restore_lead(uuid) to authenticated;
grant execute on function public.save_client_week(uuid, integer, text, date, numeric, numeric, date, numeric, uuid, text) to authenticated;
grant execute on function public.set_my_commission_pin(text, text) to authenticated;
grant execute on function public.soft_delete_client(uuid) to authenticated;
grant execute on function public.soft_delete_lead(uuid) to authenticated;
grant execute on function public.verify_seller_box(uuid, text) to authenticated;
grant execute on function public.void_client_week(uuid, integer, text) to authenticated;
grant execute on function public.void_plan_upgrade(uuid, text) to authenticated;
