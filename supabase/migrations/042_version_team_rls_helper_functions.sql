-- Versiona helpers oficiais de RLS exportados do Supabase de producao via pg_get_functiondef.
-- Nao altera comportamento, policies, RLS, grants ou codigo da aplicacao.

CREATE OR REPLACE FUNCTION public.user_is_team_admin(p_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.team_members
    where team_id = p_team and user_id = auth.uid() and role in ('owner','admin'));
$function$;

CREATE OR REPLACE FUNCTION public.user_team_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select team_id from public.team_members where user_id = auth.uid();
$function$;
