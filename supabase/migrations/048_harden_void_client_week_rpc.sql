-- 048_harden_void_client_week_rpc.sql
--
-- SECURITY-RPC-001 (P0 do CODE-REVIEW-003). public.void_client_week era SECURITY DEFINER, tinha EXECUTE para
-- o PUBLIC (logo `anon`) e NÃO validava auth.uid() nem ownership. Como a anon key é pública (vai no bundle do
-- app), qualquer pessoa podia chamar POST /rest/v1/rpc/void_client_week com QUALQUER p_client_id e anular
-- client_payments + apagar a weekly_payment (comissão) daquela semana, em QUALQUER tenant — contornando o RLS
-- e o PIN da UI.
--
-- Correção (SEM mudar regra financeira/cálculo, SEM tocar schema, SEM tocar dados):
--   1) exige usuário autenticado (auth.uid() não nulo);
--   2) resolve o team_id do cliente recebido;
--   3) exige que o usuário seja owner/admin DAQUELA equipe (user_is_team_admin) — nunca opera cross-tenant;
--   4) o CORPO original (anular client_payments + remover a weekly_payment derivada) é PRESERVADO intacto.
--
-- Grants (defense-in-depth): o default do Postgres concede EXECUTE ao PUBLIC (anon herda), então revogar de
-- `anon` sozinho é no-op — revogamos do PUBLIC e concedemos explicitamente a `authenticated` (que é quem o app
-- usa). Aplicado às funções MUTÁVEIS expostas via REST. NÃO se toca nas helpers de RLS
-- (user_team_ids/user_seller_ids/user_is_team_admin — usadas dentro das policies, só retornam dados do próprio
-- caller) nem nas funções de TRIGGER (retornam `trigger`, então o PostgREST nem as expõe via RPC).
--
-- OBS de histórico: em produção o fix foi aplicado em dois passos (guarda do corpo; depois correção do grant
-- de PUBLIC). Este arquivo é a forma final consolidada e reprodutível.

create or replace function public.void_client_week(p_client_id uuid, p_numero_semana integer, p_motivo text default null)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_uid  uuid := auth.uid();
  v_team uuid;
  v_deal_id uuid;
begin
  -- ── GUARDA (SECURITY-RPC-001) ─────────────────────────────────────────────
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select team_id into v_team from public.clients where id = p_client_id;
  if v_team is null then
    raise exception 'cliente inexistente';
  end if;
  if not public.user_is_team_admin(v_team) then
    raise exception 'sem permissao (apenas owner/admin da equipe do cliente)';
  end if;

  -- ── CORPO ORIGINAL (inalterado — mesma regra/critério; nada recalculado) ──
  -- 1) Anula a receita da semana (flag, SEM hard-delete) — mesmas colunas/critério de antes.
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

-- ── GRANTS: fechar os RPCs mutáveis para anon (revogar do PUBLIC + conceder a authenticated) ──
revoke execute on function public.void_client_week(uuid, integer, text) from public;
grant  execute on function public.void_client_week(uuid, integer, text) to authenticated;

-- Higiene: mutáveis expostos via REST que já se auto-guardam (auth.uid()+admin), sempre chamados autenticados.
revoke execute on function public.create_team(text) from public;
grant  execute on function public.create_team(text) to authenticated;
revoke execute on function public.create_invite(uuid, text, integer, text) from public;
grant  execute on function public.create_invite(uuid, text, integer, text) to authenticated;
revoke execute on function public.redeem_invite(text) from public;
grant  execute on function public.redeem_invite(text) to authenticated;
