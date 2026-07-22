-- Histórico permanente de observações de leads e clientes.
-- A origem é apenas uma referência textual: excluir a tarefa/evento nunca exclui a observação.
begin;

create table if not exists public.entity_observations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  entity_type text not null check (entity_type in ('lead', 'client')),
  entity_id uuid not null,
  body text not null check (length(trim(body)) > 0),
  source_type text not null default 'manual',
  source_id uuid,
  source_label text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create unique index if not exists entity_observations_source_uidx
  on public.entity_observations(team_id, entity_type, entity_id, source_type, source_id)
  where source_id is not null;
create index if not exists entity_observations_entity_idx
  on public.entity_observations(team_id, entity_type, entity_id, created_at desc);

alter table public.entity_observations enable row level security;
drop policy if exists entity_observations_select on public.entity_observations;
create policy entity_observations_select on public.entity_observations for select to authenticated
  using (
    (entity_type = 'lead' and public.user_has_module_level(team_id, 'comercial', 'view'))
    or (entity_type = 'client' and public.user_has_module_level(team_id, 'clientes', 'view'))
  );
drop policy if exists entity_observations_insert on public.entity_observations;
create policy entity_observations_insert on public.entity_observations for insert to authenticated
  with check (
    (entity_type = 'lead' and public.user_has_module_level(team_id, 'comercial', 'edit'))
    or (entity_type = 'client' and public.user_has_module_level(team_id, 'clientes', 'edit'))
  );
drop policy if exists entity_observations_update on public.entity_observations;
create policy entity_observations_update on public.entity_observations for update to authenticated
  using (
    (entity_type = 'lead' and public.user_has_module_level(team_id, 'comercial', 'edit'))
    or (entity_type = 'client' and public.user_has_module_level(team_id, 'clientes', 'edit'))
  )
  with check (
    (entity_type = 'lead' and public.user_has_module_level(team_id, 'comercial', 'edit'))
    or (entity_type = 'client' and public.user_has_module_level(team_id, 'clientes', 'edit'))
  );

-- Upsert central usado pelos gatilhos. Não apaga texto quando a origem é apagada ou esvaziada.
create or replace function public.persist_entity_observation(
  p_team_id uuid, p_entity_type text, p_entity_id uuid, p_body text,
  p_source_type text, p_source_id uuid, p_source_label text,
  p_created_by uuid, p_created_by_name text, p_created_at timestamptz default now()
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_team_id is null or p_entity_id is null or nullif(trim(p_body), '') is null then return; end if;
  insert into public.entity_observations (
    team_id, entity_type, entity_id, body, source_type, source_id, source_label,
    created_by, created_by_name, created_at, updated_at
  ) values (
    p_team_id, p_entity_type, p_entity_id, trim(p_body), p_source_type, p_source_id, p_source_label,
    p_created_by, p_created_by_name, coalesce(p_created_at, now()), now()
  )
  on conflict (team_id, entity_type, entity_id, source_type, source_id) where source_id is not null
  do update set
    -- Depois de uma edição feita na aba Observações, o texto se torna independente da fonte.
    body = case when entity_observations.edited_at is null then excluded.body else entity_observations.body end,
    source_label = excluded.source_label,
    updated_at = case when entity_observations.edited_at is null then now() else entity_observations.updated_at end;
end;
$$;
revoke execute on function public.persist_entity_observation(uuid,text,uuid,text,text,uuid,text,uuid,text,timestamptz) from public;

create or replace function public.sync_task_observation() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_name text;
begin
  if new.linked_type not in ('lead', 'client') or new.linked_id is null or nullif(trim(new.notes), '') is null then return new; end if;
  select name into v_name from public.profiles where id = coalesce(auth.uid(), new.user_id);
  perform public.persist_entity_observation(
    new.team_id, new.linked_type, new.linked_id, new.notes, 'task', new.id,
    'Tarefa: ' || new.title, coalesce(auth.uid(), new.user_id), v_name, new.created_at
  );
  return new;
end;
$$;
drop trigger if exists sync_task_observation_trigger on public.tasks;
create trigger sync_task_observation_trigger after insert or update of notes, title, linked_type, linked_id on public.tasks
  for each row execute function public.sync_task_observation();

create or replace function public.sync_lead_interaction_observation() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if nullif(trim(new.note), '') is null then return new; end if;
  perform public.persist_entity_observation(
    new.team_id, 'lead', new.lead_id, new.note, 'lead_interaction', new.id,
    case when new.type = 'situacao' then 'Atualização da situação' when new.type = 'nota' then 'Observação manual' else 'Interação: ' || replace(new.type, '_', ' ') end,
    new.created_by, new.created_by_name, new.created_at
  );
  return new;
end;
$$;
drop trigger if exists sync_lead_interaction_observation_trigger on public.lead_interactions;
create trigger sync_lead_interaction_observation_trigger after insert or update of note on public.lead_interactions
  for each row execute function public.sync_lead_interaction_observation();

create or replace function public.sync_client_payment_observation() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_name text;
begin
  if nullif(trim(new.observacao), '') is null then return new; end if;
  select name into v_name from public.profiles where id = coalesce(new.updated_by, auth.uid());
  perform public.persist_entity_observation(
    new.team_id, 'client', new.client_id, new.observacao, 'client_payment', new.id,
    'Financeiro: semana ' || new.numero_semana, coalesce(new.updated_by, auth.uid()), v_name, coalesce(new.updated_at, new.paid_on::timestamptz, now())
  );
  return new;
end;
$$;
drop trigger if exists sync_client_payment_observation_trigger on public.client_payments;
create trigger sync_client_payment_observation_trigger after insert or update of observacao on public.client_payments
  for each row execute function public.sync_client_payment_observation();

create or replace function public.sync_plan_change_observation() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_name text;
begin
  if nullif(trim(new.observacao), '') is null then return new; end if;
  select name into v_name from public.profiles where id = coalesce(new.changed_by, auth.uid());
  perform public.persist_entity_observation(
    new.team_id, 'client', new.client_id, new.observacao, 'plan_change', new.id,
    'Alteração de plano', coalesce(new.changed_by, auth.uid()), v_name, new.changed_at::timestamptz
  );
  return new;
end;
$$;
drop trigger if exists sync_plan_change_observation_trigger on public.plan_changes;
create trigger sync_plan_change_observation_trigger after insert or update of observacao on public.plan_changes
  for each row execute function public.sync_plan_change_observation();

-- Recupera observações ainda existentes nas fontes atuais.
insert into public.entity_observations (team_id, entity_type, entity_id, body, source_type, source_id, source_label, created_by, created_by_name, created_at)
select team_id, linked_type, linked_id, trim(notes), 'task', id, 'Tarefa: ' || title, user_id,
       (select p.name from public.profiles p where p.id = tasks.user_id), created_at
from public.tasks
where team_id is not null and linked_type in ('lead', 'client') and linked_id is not null and nullif(trim(notes), '') is not null
on conflict do nothing;

insert into public.entity_observations (team_id, entity_type, entity_id, body, source_type, source_id, source_label, created_by, created_by_name, created_at)
select team_id, 'lead', lead_id, trim(note), 'lead_interaction', id,
       case when type = 'situacao' then 'Atualização da situação' when type = 'nota' then 'Observação manual' else 'Interação: ' || replace(type, '_', ' ') end,
       created_by, created_by_name, created_at
from public.lead_interactions
where team_id is not null and deleted_at is null and nullif(trim(note), '') is not null
on conflict do nothing;

insert into public.entity_observations (team_id, entity_type, entity_id, body, source_type, source_id, source_label, created_by, created_by_name, created_at)
select cp.team_id, 'client', cp.client_id, trim(cp.observacao), 'client_payment', cp.id,
       'Financeiro: semana ' || cp.numero_semana, cp.updated_by, p.name, coalesce(cp.updated_at, cp.paid_on::timestamptz, now())
from public.client_payments cp left join public.profiles p on p.id = cp.updated_by
where cp.team_id is not null and cp.deleted_at is null and nullif(trim(cp.observacao), '') is not null
on conflict do nothing;

insert into public.entity_observations (team_id, entity_type, entity_id, body, source_type, source_id, source_label, created_by, created_by_name, created_at)
select pc.team_id, 'client', pc.client_id, trim(pc.observacao), 'plan_change', pc.id,
       'Alteração de plano', pc.changed_by, p.name, pc.changed_at::timestamptz
from public.plan_changes pc left join public.profiles p on p.id = pc.changed_by
where pc.team_id is not null and nullif(trim(pc.observacao), '') is not null
on conflict do nothing;

commit;
