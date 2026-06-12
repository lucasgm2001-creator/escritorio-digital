-- 015_tasks.sql
-- Área de TAREFAS (To-do) — Etapa 1 (base). App pessoal de usuário único.
--
-- RLS por DONO: cada usuário só lê/escreve as PRÓPRIAS tarefas
-- (auth.uid() = user_id). Sem papel. Mais restrito que o resto do app
-- (que usa auth.role()='authenticated'), de propósito: tarefa é pessoal.
--
-- linked_id NÃO tem FK fixa: aponta para leads OU clients conforme
-- linked_type. linked_name é desnormalizado p/ exibir sem join.
--
-- Idempotente e SEGURO re-rodar: o drop condicional abaixo só remove a `tasks`
-- ANTIGA (schema de equipe da migration 005 — sem user_id, sem UI no app atual);
-- nunca apaga a tabela nova já no schema pessoal.

-- ============================================================
-- 0. Remove a `tasks` legada — só se for o schema antigo (sem coluna user_id)
-- ============================================================
do $$
begin
  if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'tasks'
      )
     and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'tasks' and column_name = 'user_id'
      )
  then
    drop table public.tasks cascade;
  end if;
end $$;

-- ============================================================
-- 1. Tabela
-- ============================================================
create table if not exists public.tasks (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  notes        text,
  due_date     date,
  due_time     time,        -- horário opcional do dia (alarme nativo fica p/ outra fase)
  done         boolean not null default false,
  completed_at timestamptz,
  priority     text not null default 'normal' check (priority in ('normal','alta','urgente')),
  linked_type  text check (linked_type in ('lead','client')),
  linked_id    uuid,
  linked_name  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- 2. Índices (filtros da tela: por dono, por dia, pendentes)
-- ============================================================
create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists tasks_due_idx  on public.tasks (user_id, due_date);
create index if not exists tasks_done_idx on public.tasks (user_id, done);

-- ============================================================
-- 3. updated_at automático
-- ============================================================
create or replace function public.set_tasks_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_tasks_updated_at();

-- ============================================================
-- 4. RLS — só o dono acessa as próprias tarefas
-- ============================================================
alter table public.tasks enable row level security;

drop policy if exists "Dono lê tarefas"       on public.tasks;
drop policy if exists "Dono insere tarefas"   on public.tasks;
drop policy if exists "Dono atualiza tarefas" on public.tasks;
drop policy if exists "Dono deleta tarefas"   on public.tasks;

create policy "Dono lê tarefas" on public.tasks
  for select using (auth.uid() = user_id);
create policy "Dono insere tarefas" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "Dono atualiza tarefas" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Dono deleta tarefas" on public.tasks
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 5. Realtime (guardado — re-rodar não falha)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

-- ============================================================
-- Verificação: confere colunas e policies (4 de dono, todas auth.uid()=user_id)
-- ============================================================
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks'
order by ordinal_position;

select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'tasks'
order by policyname;
