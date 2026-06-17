-- 023_reconcile_schema.sql
-- DOCUMENTACAO do schema que ja existe no banco (veio de SQL inline em sessoes
-- anteriores e nunca virou arquivo). NAO precisa rodar no banco atual — ele ja tem
-- tudo. 100% idempotente: numa instancia NOVA recria o que falta; no banco atual e no-op.
-- Cobre so o drift real. (deals/weekly_payments/meetings/fx_config/seller_salaries e as
-- colunas extras de sellers ja estao filados em 005/008/009/016/017.)

-- 1) leads.stage_changed_at — base do "deal rotting" do funil
alter table public.leads
  add column if not exists stage_changed_at timestamptz default now();

-- 2) deals.lead_id — vinculo do deal ao lead (idempotencia da automacao) + FK + indice
alter table public.deals
  add column if not exists lead_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deals_lead_id_fkey') then
    alter table public.deals
      add constraint deals_lead_id_fkey
      foreign key (lead_id) references public.leads(id) on delete set null;
  end if;
end $$;

create index if not exists idx_deals_lead_id on public.deals(lead_id);

-- 3) sellers.photo_url — foto do vendedor
alter table public.sellers
  add column if not exists photo_url text;

-- 4) presentations — apresentacoes montadas no Studio
create table if not exists public.presentations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  lead_id    uuid references public.leads(id) on delete set null,
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.presentations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentations' and policyname='Auth le presentations') then
    create policy "Auth le presentations" on public.presentations for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentations' and policyname='Auth insere presentations') then
    create policy "Auth insere presentations" on public.presentations for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentations' and policyname='Auth atualiza presentations') then
    create policy "Auth atualiza presentations" on public.presentations for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentations' and policyname='Auth deleta presentations') then
    create policy "Auth deleta presentations" on public.presentations for delete using (auth.role() = 'authenticated');
  end if;
end $$;

-- 5) presentation_materials — biblioteca de materiais do Studio
-- (SELECT/INSERT/DELETE; SEM update, igual ao banco)
create table if not exists public.presentation_materials (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  storage_path text not null,
  url          text not null,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz default now()
);
alter table public.presentation_materials enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentation_materials' and policyname='Auth le materials') then
    create policy "Auth le materials" on public.presentation_materials for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentation_materials' and policyname='Auth insere materials') then
    create policy "Auth insere materials" on public.presentation_materials for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='presentation_materials' and policyname='Auth deleta materials') then
    create policy "Auth deleta materials" on public.presentation_materials for delete using (auth.role() = 'authenticated');
  end if;
end $$;
