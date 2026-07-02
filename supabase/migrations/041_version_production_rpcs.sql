-- Versiona RPCs oficiais exportadas do Supabase de producao via pg_get_functiondef.
-- Nao altera comportamento, assinaturas, permissoes, RLS, grants ou search_path.

CREATE OR REPLACE FUNCTION public.create_team(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_team uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'nome da equipe obrigatorio'; end if;
  insert into public.teams (name, owner_id) values (trim(p_name), v_uid) returning id into v_team;
  insert into public.team_members (team_id, user_id, role) values (v_team, v_uid, 'owner');
  return v_team;
end $function$;

CREATE OR REPLACE FUNCTION public.find_lead_for_enrich(p_email text, p_phone_digits text)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select id from public.leads
  where status <> 'lixeira'
    and (
      (coalesce(p_email,'') <> '' and lower(email) = lower(p_email))
      or (coalesce(p_phone_digits,'') <> '' and length(p_phone_digits) >= 8
          and regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') like '%' || p_phone_digits)
    )
  order by received_at desc nulls last, created_at desc nulls last
  limit 1
$function$;

CREATE OR REPLACE FUNCTION public.redeem_invite(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_inv public.team_invites%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_inv from public.team_invites where token = p_token for update;
  if not found then raise exception 'convite invalido'; end if;
  if v_inv.used_at is not null then raise exception 'convite ja utilizado'; end if;
  if v_inv.expires_at < now() then raise exception 'convite expirado'; end if;
  insert into public.team_members (team_id, user_id, role, permissions)
    values (v_inv.team_id, v_uid, v_inv.role, coalesce(v_inv.permissions,'{}'::jsonb))
    on conflict (team_id, user_id) do nothing;
  update public.team_invites set used_at = now(), used_by = v_uid where id = v_inv.id;
  return v_inv.team_id;
end $function$;

CREATE OR REPLACE FUNCTION public.set_my_commission_pin(current_pin text, new_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  uid uuid := auth.uid();
  cur_ok boolean;
begin
  if uid is null then return false; end if;
  if new_pin is null or new_pin !~ '^[0-9]{4}$' then return false; end if;
  select (commission_pin_hash is not null and commission_pin_hash = extensions.crypt(current_pin, commission_pin_hash))
    into cur_ok from public.profiles where id = uid;
  if not coalesce(cur_ok,false) then return false; end if;
  update public.profiles set commission_pin_hash = extensions.crypt(new_pin, extensions.gen_salt('bf')) where id = uid;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.verify_seller_box(target_seller_id uuid, pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  uid uuid := auth.uid();
  mgr boolean;
  target_user uuid;
  allowed boolean;
  pin_ok boolean;
begin
  if uid is null then return false; end if;
  select coalesce(is_manager,false) into mgr from public.profiles where id = uid;
  select user_id into target_user from public.sellers where id = target_seller_id;
  -- regra de papel: chefe abre qualquer box; vendedor só a própria
  allowed := coalesce(mgr,false) or (target_user is not null and target_user = uid);
  if not allowed then return false; end if;
  -- valida o PIN do PRÓPRIO usuário logado
  select (commission_pin_hash is not null and commission_pin_hash = extensions.crypt(pin, commission_pin_hash))
    into pin_ok from public.profiles where id = uid;
  return coalesce(pin_ok,false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.void_client_week(p_client_id uuid, p_numero_semana integer, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_deal_id uuid;
begin
  -- 1) Anula a receita da semana (flag, SEM delete) — mesmas colunas/critério de antes.
  update public.client_payments
     set anulado = true,
         anulado_em = now(),
         anulado_motivo = p_motivo
   where client_id = p_client_id
     and numero_semana = p_numero_semana;
  -- 2) Remove a comissão derivada da MESMA semana, no deal mais recente do cliente.
  select id into v_deal_id
    from public.deals
   where client_id = p_client_id
   order by data_fechamento desc
   limit 1;
  if v_deal_id is not null then
    delete from public.weekly_payments
     where deal_id = v_deal_id
       and numero_semana = p_numero_semana;
  end if;
end;
$function$;
