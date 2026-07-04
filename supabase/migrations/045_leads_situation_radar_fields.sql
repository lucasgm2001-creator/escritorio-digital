-- 045_leads_situation_radar_fields.sql
--
-- RADAR-COMERCIAL-001 (autorizada). Campos de SITUAÇÃO do lead para o Radar Comercial.
-- Fonte oficial: docs/proposta-radar-comercial.md
--
-- Esta migration:
--   * é 100% aditiva e idempotente (add column if not exists / index if not exists);
--   * NÃO toca colunas existentes; NÃO remove/recria; NÃO faz DROP/TRUNCATE; NÃO apaga dados;
--   * NÃO altera RLS (as novas colunas herdam as policies team-scoped já existentes de leads);
--   * NÃO mexe em regra financeira/comissão.
--
-- next_action_at REUSA leads.next_contact (date) — não há coluna nova para "quando".
-- Enums validados NA APLICAÇÃO (sem CHECK rígido) para evoluir sem nova migration:
--   last_action:    respondeu_interessado|pediu_retorno|marcou_reuniao|recebeu_proposta|nao_respondeu|desistiu|fechou|sem_mudanca
--   next_action:    nenhuma|ligar|mensagem|cobrar_retorno|enviar_proposta|marcar_reuniao|aguardar
--   temperature:    frio|morno|quente|muito_quente
--   followup_state: precisa_agir|aguardando|agendado|sem_atualizacao|desistiu|fechado|perdido

alter table public.leads
  add column if not exists current_situation    text,
  add column if not exists last_action          text,
  add column if not exists next_action          text,
  add column if not exists temperature          text,
  add column if not exists followup_state       text,
  add column if not exists situation_updated_at timestamptz;

create index if not exists idx_leads_followup on public.leads(team_id, followup_state);
