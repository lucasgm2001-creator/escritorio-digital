-- 006_leads_extra_fields.sql
-- Adiciona campos extras na tabela de leads

alter table public.leads
  add column if not exists nicho text,
  add column if not exists origem text check (origem in ('instagram', 'google', 'indicacao', 'tiktok', 'site', 'outro')),
  add column if not exists prioridade text default 'media' check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  add column if not exists next_contact date;
