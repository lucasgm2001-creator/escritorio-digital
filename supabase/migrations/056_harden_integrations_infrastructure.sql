-- 056_harden_integrations_infrastructure.sql
--
-- Hardening aditivo para integrações. Não ativa conectores reais.
-- Objetivo: preparar secrets criptografados, OAuth state, audit trail, idempotência e status de mensagens.

-- ============================================================
-- 1. Stripe event log multi-tenant ready
-- ============================================================
alter table public.stripe_webhook_events add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.stripe_webhook_events add column if not exists provider text not null default 'stripe';
alter table public.stripe_webhook_events add column if not exists request_id text;
alter table public.stripe_webhook_events add column if not exists correlation_id text;
alter table public.stripe_webhook_events add column if not exists attempts integer not null default 0;
alter table public.stripe_webhook_events add column if not exists next_retry_at timestamptz;

create index if not exists idx_stripe_webhook_events_team on public.stripe_webhook_events (team_id);
create index if not exists idx_stripe_webhook_events_retry on public.stripe_webhook_events (processed, next_retry_at);

-- ============================================================
-- 2. Encrypted-secret slots. Os campos plaintext da migration 055 ficam
--    compatíveis, mas os conectores novos devem usar *_ciphertext + key id.
-- ============================================================
alter table public.team_ads_credentials add column if not exists google_refresh_token_ciphertext text;
alter table public.team_ads_credentials add column if not exists meta_access_token_ciphertext text;
alter table public.team_ads_credentials add column if not exists encryption_key_id text;
alter table public.team_ads_credentials add column if not exists token_rotated_at timestamptz;

alter table public.team_whatsapp_credentials add column if not exists access_token_ciphertext text;
alter table public.team_whatsapp_credentials add column if not exists encryption_key_id text;
alter table public.team_whatsapp_credentials add column if not exists token_rotated_at timestamptz;

-- ============================================================
-- 3. OAuth state persistível para nonce one-time, expiração e auditoria.
-- ============================================================
create table if not exists public.integration_oauth_states (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null check (provider in ('google_ads', 'meta_ads')),
  team_id        uuid not null references public.teams(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  nonce_hash     text not null unique,
  redirect_path  text not null default '/configuracoes',
  expires_at     timestamptz not null,
  consumed_at    timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.integration_oauth_states enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='integration_oauth_states' and policyname='Admins leem integration_oauth_states') then
    create policy "Admins leem integration_oauth_states" on public.integration_oauth_states
      for select to authenticated
      using (user_is_team_admin(team_id));
  end if;
end $$;

create index if not exists idx_integration_oauth_states_team_provider on public.integration_oauth_states (team_id, provider);
create index if not exists idx_integration_oauth_states_expiry on public.integration_oauth_states (expires_at);

-- ============================================================
-- 4. Audit trail estruturado para integrações.
-- ============================================================
create table if not exists public.integration_audit_events (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null check (provider in ('stripe', 'google_ads', 'meta_ads', 'whatsapp')),
  team_id        uuid references public.teams(id) on delete set null,
  actor_user_id  uuid references auth.users(id) on delete set null,
  request_id     text,
  correlation_id text,
  event_id       text,
  action         text not null,
  outcome        text not null check (outcome in ('accepted', 'rejected', 'failed', 'blocked')),
  reason         text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

alter table public.integration_audit_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='integration_audit_events' and policyname='Admins leem integration_audit_events') then
    create policy "Admins leem integration_audit_events" on public.integration_audit_events
      for select to authenticated
      using (team_id is null or user_is_team_admin(team_id));
  end if;
end $$;

create index if not exists idx_integration_audit_events_provider_created on public.integration_audit_events (provider, created_at desc);
create index if not exists idx_integration_audit_events_team_created on public.integration_audit_events (team_id, created_at desc);
create index if not exists idx_integration_audit_events_request on public.integration_audit_events (request_id);

-- ============================================================
-- 5. WhatsApp status correto: provider_message_id != id interno.
-- ============================================================
alter table public.whatsapp_messages_log add column if not exists provider_message_id text;
alter table public.whatsapp_messages_log add column if not exists delivered_at timestamptz;
alter table public.whatsapp_messages_log add column if not exists read_at timestamptz;
alter table public.whatsapp_messages_log add column if not exists failed_at timestamptz;
alter table public.whatsapp_messages_log add column if not exists retry_count integer not null default 0;
alter table public.whatsapp_messages_log add column if not exists next_retry_at timestamptz;

create index if not exists idx_whatsapp_log_provider_message_id on public.whatsapp_messages_log (provider_message_id);
create index if not exists idx_whatsapp_log_retry on public.whatsapp_messages_log (status, next_retry_at);
