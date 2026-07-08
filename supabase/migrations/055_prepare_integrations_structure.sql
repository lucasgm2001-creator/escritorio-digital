-- 055_prepare_integrations_structure.sql
--
-- Preparação das tabelas e esquemas para futuras integrações:
-- 1. Stripe (id do cliente/assinatura na tabela clients + tabela stripe_webhook_events)
-- 2. Google e Meta Ads (credenciais por equipe + cache de métricas de campanhas por cliente)
-- 3. WhatsApp (credenciais da API por equipe + log de mensagens enviadas/recebidas)
--
-- Migration 100% aditiva e idempotente.

-- ============================================================
-- 1. ALTERAÇÃO NA TABELA CLIENTS
-- ============================================================
alter table public.clients add column if not exists stripe_customer_id text;
alter table public.clients add column if not exists stripe_subscription_id text;
alter table public.clients add column if not exists whatsapp_opt_in boolean not null default true;

-- ============================================================
-- 2. STRIPE WEBHOOK EVENTS (Log e processamento de eventos)
-- ============================================================
create table if not exists public.stripe_webhook_events (
  id            uuid primary key default gen_random_uuid(),
  event_id      text unique not null,
  type          text not null,
  data          jsonb not null,
  processed     boolean not null default false,
  error_message text,
  created_at    timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='stripe_webhook_events' and policyname='Admins leem stripe_webhook_events') then
    create policy "Admins leem stripe_webhook_events" on public.stripe_webhook_events
      for select to authenticated
      using (exists (select 1 from public.team_members where user_id = auth.uid() and role in ('owner', 'admin')));
  end if;
end $$;

-- ============================================================
-- 3. TEAM ADS CREDENTIALS (Credenciais de Google e Meta Ads por Equipe)
-- ============================================================
create table if not exists public.team_ads_credentials (
  id                     uuid primary key default gen_random_uuid(),
  team_id                uuid not null references public.teams(id) on delete cascade unique,
  google_ads_customer_id          text,
  google_refresh_token_ciphertext text,
  meta_ad_account_id              text,
  meta_access_token_ciphertext    text,
  encryption_key_id               text,
  token_rotated_at                timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.team_ads_credentials enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_ads_credentials' and policyname='Admins gerenciam team_ads_credentials') then
    create policy "Admins gerenciam team_ads_credentials" on public.team_ads_credentials
      for all to authenticated
      using (user_is_team_admin(team_id))
      with check (user_is_team_admin(team_id));
  end if;
end $$;

-- ============================================================
-- 4. ADS CAMPAIGN METRICS (Cache de métricas diárias de anúncios por cliente)
-- ============================================================
create table if not exists public.ads_campaign_metrics (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  platform      text not null check (platform in ('google_ads', 'meta_ads')),
  campaign_id   text not null,
  campaign_name text not null,
  status        text,
  clicks        integer not null default 0,
  impressions   integer not null default 0,
  ctr           numeric not null default 0,
  spend         numeric not null default 0,
  conversions   numeric not null default 0,
  cpc           numeric not null default 0,
  date          date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (team_id, client_id, platform, campaign_id, date)
);

alter table public.ads_campaign_metrics enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ads_campaign_metrics' and policyname='Membros leem ads_campaign_metrics') then
    create policy "Membros leem ads_campaign_metrics" on public.ads_campaign_metrics
      for select to authenticated
      using (team_id in (select user_team_ids()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ads_campaign_metrics' and policyname='Admins gerenciam ads_campaign_metrics') then
    create policy "Admins gerenciam ads_campaign_metrics" on public.ads_campaign_metrics
      for all to authenticated
      using (user_is_team_admin(team_id))
      with check (user_is_team_admin(team_id));
  end if;
end $$;

create index if not exists idx_ads_metrics_team_client on public.ads_campaign_metrics (team_id, client_id);
create index if not exists idx_ads_metrics_date on public.ads_campaign_metrics (date);

-- ============================================================
-- 5. TEAM WHATSAPP CREDENTIALS (Credenciais do WhatsApp por Equipe)
-- ============================================================
create table if not exists public.team_whatsapp_credentials (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams(id) on delete cascade unique,
  phone_number_id text,
  waba_id         text,
  access_token_ciphertext text,
  encryption_key_id       text,
  token_rotated_at        timestamptz,
  provider                text not null default 'official_meta' check (provider in ('official_meta', 'twilio', 'evolution')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.team_whatsapp_credentials enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_whatsapp_credentials' and policyname='Admins gerenciam team_whatsapp_credentials') then
    create policy "Admins gerenciam team_whatsapp_credentials" on public.team_whatsapp_credentials
      for all to authenticated
      using (user_is_team_admin(team_id))
      with check (user_is_team_admin(team_id));
  end if;
end $$;

-- ============================================================
-- 6. WHATSAPP MESSAGES LOG (Histórico de envios de mensagens)
-- ============================================================
create table if not exists public.whatsapp_messages_log (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete set null,
  to_phone      text not null,
  direction     text not null check (direction in ('inbound', 'outbound')),
  status        text not null check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  body          text not null,
  error_message text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.whatsapp_messages_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_messages_log' and policyname='Membros leem whatsapp_messages_log') then
    create policy "Membros leem whatsapp_messages_log" on public.whatsapp_messages_log
      for select to authenticated
      using (team_id in (select user_team_ids()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='whatsapp_messages_log' and policyname='Membros inserem whatsapp_messages_log') then
    create policy "Membros inserem whatsapp_messages_log" on public.whatsapp_messages_log
      for insert to authenticated
      with check (team_id in (select user_team_ids()));
  end if;
end $$;

create index if not exists idx_whatsapp_log_team_client on public.whatsapp_messages_log (team_id, client_id);
create index if not exists idx_whatsapp_log_created on public.whatsapp_messages_log (created_at);
