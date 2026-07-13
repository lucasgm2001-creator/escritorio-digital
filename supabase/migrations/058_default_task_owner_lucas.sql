-- 058 — Lucas como responsável padrão de novas tarefas.
-- IMPORTANTE: responsavel_id referencia sellers.id, não profiles.id/user_id.

create or replace function public.set_lucas_as_default_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'leads' then
    if new.assigned_to is null then
      new.assigned_to := '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid;
    end if;
    if nullif(btrim(new.assigned_name), '') is null then
      new.assigned_name := 'Lucas';
    end if;
  elsif tg_table_name = 'tasks' then
    if new.responsavel_id is null then
      new.responsavel_id := 'd129ace7-424b-4434-88af-baa3781cb568'::uuid;
    end if;
    if nullif(btrim(new.responsavel_nome), '') is null then
      new.responsavel_nome := 'Lucas';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_default_lucas on public.leads;
create trigger leads_default_lucas
  before insert on public.leads
  for each row execute function public.set_lucas_as_default_owner();

drop trigger if exists tasks_default_lucas on public.tasks;
create trigger tasks_default_lucas
  before insert on public.tasks
  for each row execute function public.set_lucas_as_default_owner();
