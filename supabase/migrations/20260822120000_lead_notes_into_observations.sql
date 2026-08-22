-- A nota do PRÓPRIO lead (leads.notes) também é observação.
--
-- O histórico permanente já reunia quatro origens em entity_observations, cada uma pelo seu gatilho:
-- lead_interactions (nota manual, situação, contato), tasks.notes (tarefa ligada a lead/cliente),
-- client_payments e plan_changes. Faltava a mais antiga de todas: o campo "Mensagem / notas" do lead,
-- preenchido na criação (LeadModal) e editável no perfil (LeadDiary). Ele nunca chegava ao banco
-- unificado, então a observação existia na ficha do lead mas sumia de qualquer lugar que lesse o
-- histórico. Em produção eram 28 leads com nota, todas invisíveis.
--
-- Mesma mecânica dos outros quatro: INSERT+UPDATE, reusando persist_entity_observation — que faz upsert
-- por (team, entidade, source_type, source_id) e PRESERVA o texto quando a observação já foi editada à
-- mão (edited_at não nulo). Nada é duplicado e nada sobrescreve edição humana.

begin;

create or replace function public.sync_lead_note_observation()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if nullif(trim(new.notes), '') is null then return new; end if;
  -- Só reescreve quando a nota realmente mudou (UPDATE de outro campo não mexe na observação).
  if tg_op = 'UPDATE' and coalesce(old.notes, '') = coalesce(new.notes, '') then return new; end if;
  perform public.persist_entity_observation(
    new.team_id, 'lead', new.id, new.notes, 'lead_note', new.id,
    'Nota do lead', coalesce(auth.uid(), new.assigned_to), new.assigned_name, new.created_at
  );
  return new;
end;
$$;

drop trigger if exists sync_lead_note_observation_trigger on public.leads;
create trigger sync_lead_note_observation_trigger
  after insert or update of notes on public.leads
  for each row execute function public.sync_lead_note_observation();

-- Backfill das notas que já existiam. Idempotente pelo mesmo upsert do gatilho.
do $$
declare r record;
begin
  for r in
    select id, team_id, notes, assigned_to, assigned_name, created_at
    from public.leads
    where nullif(trim(notes), '') is not null and team_id is not null
  loop
    perform public.persist_entity_observation(
      r.team_id, 'lead', r.id, r.notes, 'lead_note', r.id,
      'Nota do lead', r.assigned_to, r.assigned_name, r.created_at
    );
  end loop;
end $$;

commit;
