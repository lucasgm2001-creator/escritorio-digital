-- SECURITY-HARDENING-002
-- Policies RLS são avaliadas como o chamador e precisam de EXECUTE nos helpers.
-- As funções retornam somente equipes/vendedores do próprio auth.uid() ou booleanos.
grant execute on function public.user_team_ids() to authenticated;
grant execute on function public.user_seller_ids() to authenticated;
grant execute on function public.user_is_team_admin(uuid) to authenticated;
grant execute on function public.user_has_module_level(uuid, text, text) to authenticated;
grant execute on function public.user_is_any_team_owner() to authenticated;
