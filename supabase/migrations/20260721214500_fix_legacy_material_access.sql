-- SECURITY-HARDENING-004
-- Qualifica a coluna externa; sem isso `name` era resolvido como pm.name.
drop policy if exists materiais_select_team on storage.objects;
create policy materiais_select_team on storage.objects for select to authenticated
  using (
    bucket_id = 'materiais' and (
      (
        (storage.foldername(name))[1] in (select public.user_team_ids()::text)
        and public.user_has_module_level(((storage.foldername(name))[1])::uuid, 'comercial', 'read')
      )
      or exists (
        select 1
          from public.presentation_materials pm
         where pm.storage_path = objects.name
           and pm.team_id in (select public.user_team_ids())
      )
    )
  );
