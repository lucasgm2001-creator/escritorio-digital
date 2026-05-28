-- ============================================================
-- 005_missing_tables.sql
-- Tabelas faltantes: sellers, commissions, tasks, payments,
-- campaigns, expenses, activities, notices
-- ============================================================

-- ============================================================
-- SELLERS
-- Vendedores cadastrados no comercial
-- ============================================================
create table if not exists public.sellers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text,
  phone text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  total_sales numeric not null default 0,
  total_commissions numeric not null default 0,
  leads_assigned integer not null default 0,
  conversion_rate numeric not null default 0,
  created_at timestamptz default now()
);

alter table public.sellers enable row level security;
create policy "Auth lê sellers"    on public.sellers for select using (auth.role() = 'authenticated');
create policy "Auth insere sellers" on public.sellers for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza sellers" on public.sellers for update using (auth.role() = 'authenticated');

-- ============================================================
-- ACTIVITIES
-- Feed de atividades do Hall (log global do sistema)
-- ============================================================
create table if not exists public.activities (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('lead', 'client', 'payment', 'task', 'campaign', 'system')),
  description text not null,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text,
  entity_id uuid,
  created_at timestamptz default now()
);

alter table public.activities enable row level security;
create policy "Auth lê activities"    on public.activities for select using (auth.role() = 'authenticated');
create policy "Auth insere activities" on public.activities for insert with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table public.activities;

-- ============================================================
-- NOTICES
-- Mural de avisos do Hall
-- ============================================================
create table if not exists public.notices (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  priority text not null default 'info' check (priority in ('info', 'warning', 'urgent')),
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table public.notices enable row level security;
create policy "Auth lê notices"    on public.notices for select using (auth.role() = 'authenticated');
create policy "Auth insere notices" on public.notices for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza notices" on public.notices for update using (auth.role() = 'authenticated');
create policy "Auth deleta notices"  on public.notices for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table public.notices;

-- ============================================================
-- COMMISSIONS
-- Comissões geradas ao fechar um lead no comercial
-- ============================================================
create table if not exists public.commissions (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete set null,
  seller_name text,
  lead_id uuid references public.leads(id) on delete set null,
  lead_name text,
  client_id uuid references public.clients(id) on delete set null,
  amount numeric not null default 0,
  percentage numeric not null default 0,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'paga')),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz default now()
);

alter table public.commissions enable row level security;
create policy "Auth lê commissions"    on public.commissions for select using (auth.role() = 'authenticated');
create policy "Auth insere commissions" on public.commissions for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza commissions" on public.commissions for update using (auth.role() = 'authenticated');

-- ============================================================
-- TASKS
-- Tarefas internas da equipe
-- ============================================================
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_name text,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'urgente')),
  due_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;
create policy "Auth lê tasks"    on public.tasks for select using (auth.role() = 'authenticated');
create policy "Auth insere tasks" on public.tasks for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza tasks" on public.tasks for update using (auth.role() = 'authenticated');
create policy "Auth deleta tasks"   on public.tasks for delete using (auth.role() = 'authenticated');

-- ============================================================
-- PAYMENTS
-- Fluxo de caixa: receitas e despesas (financeiro)
-- ============================================================
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete set null,
  description text not null,
  amount numeric not null default 0,
  type text not null check (type in ('receita', 'despesa')),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado', 'atrasado')),
  due_date date not null,
  paid_at timestamptz,
  category text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.payments enable row level security;
create policy "Auth lê payments"    on public.payments for select using (auth.role() = 'authenticated');
create policy "Auth insere payments" on public.payments for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza payments" on public.payments for update using (auth.role() = 'authenticated');
create policy "Auth deleta payments"   on public.payments for delete using (auth.role() = 'authenticated');

-- ============================================================
-- CAMPAIGNS
-- Campanhas de tráfego pago (Google, Meta, etc.)
-- ============================================================
create table if not exists public.campaigns (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  platform text not null default 'meta' check (platform in ('google', 'meta', 'instagram', 'tiktok', 'outro')),
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'encerrada')),
  budget numeric not null default 0,
  spent numeric not null default 0,
  leads integer not null default 0,
  conversions integer not null default 0,
  start_date date not null default current_date,
  end_date date,
  managed_by uuid references public.profiles(id) on delete set null,
  managed_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.campaigns enable row level security;
create policy "Auth lê campaigns"    on public.campaigns for select using (auth.role() = 'authenticated');
create policy "Auth insere campaigns" on public.campaigns for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza campaigns" on public.campaigns for update using (auth.role() = 'authenticated');
create policy "Auth deleta campaigns"   on public.campaigns for delete using (auth.role() = 'authenticated');

-- ============================================================
-- EXPENSES
-- Despesas fixas e recorrentes da empresa
-- ============================================================
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  description text not null,
  amount numeric not null default 0,
  category text default 'outros' check (category in ('aluguel', 'pessoal', 'marketing', 'tecnologia', 'impostos', 'outros')),
  recurrence text not null default 'mensal' check (recurrence in ('unica', 'mensal', 'trimestral', 'anual')),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  due_date date,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;
create policy "Auth lê expenses"    on public.expenses for select using (auth.role() = 'authenticated');
create policy "Auth insere expenses" on public.expenses for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza expenses" on public.expenses for update using (auth.role() = 'authenticated');
create policy "Auth deleta expenses"   on public.expenses for delete using (auth.role() = 'authenticated');
