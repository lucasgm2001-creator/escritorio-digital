-- 029_plans_revenue.sql  (JÁ APLICADA no banco — documentação, idempotente)
-- Comissão nova, INCREMENTO 1: planos + plano do cliente + ledger de receita (estrutura).
-- NÃO mexe em pagamento/comissão (calc.ts/payWeek/registerMeeting/runWonFlow intocados).

-- 1) PLANOS (editáveis)
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  valor_semanal numeric not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plans' and policyname='Auth le plans') then
    create policy "Auth le plans" on public.plans for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plans' and policyname='Auth gere plans') then
    create policy "Auth gere plans" on public.plans for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;
insert into public.plans (nome, valor_semanal, ordem) values
 ('Start', 140, 1), ('Growth', 190, 2), ('Escalate', 250, 3)
on conflict (nome) do nothing;

-- 2) CLIENTE → PLANO (1 plano por cliente)
alter table public.clients add column if not exists plano_id uuid references public.plans(id) on delete set null;
-- backfill: casa o plan_weekly legado com o plano de mesmo valor_semanal (140/190/250).
update public.clients c
   set plano_id = p.id
  from public.plans p
 where c.plano_id is null and c.plan_weekly = p.valor_semanal;

-- 3) RECEITA do cliente (verdade do pagamento; sem teto; snapshot do valor). Estrutura só —
--    o fluxo de marcar semana/derivar comissão é o incremento 2.
create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  numero_semana integer not null,
  valor_usd numeric not null,
  paid_on date not null,
  cotacao_usd_brl numeric not null,
  plano_id uuid references public.plans(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, numero_semana)
);
alter table public.client_payments enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_payments' and policyname='Auth le client_payments') then
    create policy "Auth le client_payments" on public.client_payments for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_payments' and policyname='Auth gere client_payments') then
    create policy "Auth gere client_payments" on public.client_payments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;
create index if not exists idx_client_payments_cli  on public.client_payments (client_id, numero_semana);
create index if not exists idx_client_payments_data on public.client_payments (paid_on);
