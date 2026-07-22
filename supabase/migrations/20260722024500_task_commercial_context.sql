-- Dá significado comercial às tarefas. O tipo alimenta o fluxo contextual de atualização do lead.
alter table public.tasks
  add column if not exists kind text not null default 'geral';

alter table public.tasks drop constraint if exists tasks_kind_check;
alter table public.tasks add constraint tasks_kind_check
  check (kind in ('geral', 'ligacao', 'whatsapp', 'agendamento', 'reuniao', 'proposta', 'followup'));

-- Recupera o contexto das tarefas antigas sem apagar qualquer dado.
update public.tasks
set kind = case
  when title ~* '(agendar|marcar.+reuni[aã]o|confirmar.+reuni[aã]o)' then 'agendamento'
  when coalesce(is_meeting, false) or title ~* '(reuni[aã]o|meeting|apresenta[cç][aã]o)' then 'reuniao'
  when title ~* '(proposta|or[cç]amento|contrato)' then 'proposta'
  when title ~* '(whats|mensagem)' then 'whatsapp'
  when title ~* '(ligar|liga[cç][aã]o|telefone)' then 'ligacao'
  when title ~* '(follow.?up|retorno|cobrar|acompanhar)' then 'followup'
  else 'geral'
end
where kind = 'geral';

create index if not exists tasks_team_user_kind_due_idx
  on public.tasks (team_id, user_id, kind, due_date)
  where done = false;
