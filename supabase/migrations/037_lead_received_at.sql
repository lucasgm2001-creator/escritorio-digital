-- 037_lead_received_at.sql
-- "Data de chegada" do lead: separa QUANDO o lead chegou de quando foi CADASTRADO
-- (pra relatório de semana não contar lead antigo na semana atual).
-- ⚠️ JÁ aplicada em produção — este arquivo existe só pra o REPO bater com o banco. NÃO rodar de novo.
-- Idempotente (ADD COLUMN IF NOT EXISTS). received_at NÃO é dinheiro (dado de lead/relatório).

alter table public.leads add column if not exists received_at date not null default current_date;
update public.leads set received_at = created_at::date where created_at is not null;
