// LEADS QUENTES (FOLLOWUP-QUENTES-001) — a "lista de oportunidades" do Follow-up.
//
// Quente = a pessoa disse que está interessada ou o lead está com proposta na mão:
//   · percepção "Quer fechar" (muito_interessado) ou "Bem interessado" (interessado), registrada no Atualizar
//     situação — vale 30 dias a partir de quando foi registrada (situation_updated_at);
//   · fase "Proposta em Análise" (slug proposta) — vale 30 dias a partir da entrada na fase (stage_changed_at).
// Quem tem as duas coisas fica até a validade mais longa. Fase encerrada (ganho, perdido, arquivo) nunca é
// quente: a oportunidade já se resolveu. Passou da validade sem nova atualização, sai da lista — é isso que
// mantém a lista curta o bastante para ser olhada todo dia.

export const HOT_VALIDITY_DAYS = 30

export type HotReason = 'quer_fechar' | 'proposta' | 'interessado'

export const HOT_REASON_LABEL: Record<HotReason, string> = {
  quer_fechar: 'Quer fechar',
  proposta: 'Proposta em análise',
  interessado: 'Bem interessado',
}

// Ordem das seções: quem disse que quer fechar primeiro; proposta antes de interesse, porque já há valor na mesa.
export const HOT_REASON_ORDER: HotReason[] = ['quer_fechar', 'proposta', 'interessado']

type HotLeadInput = {
  status: string
  temperature?: string | null
  situation_updated_at?: string | null
  stage_changed_at?: string | null
}

const DAY_MS = 86_400_000

// Dias até expirar (0 = último dia). Data inválida ou ausente = não conta.
function daysLeft(since: string | null | undefined, now: number): number | null {
  if (!since) return null
  const t = new Date(since).getTime()
  if (Number.isNaN(t)) return null
  const left = HOT_VALIDITY_DAYS - Math.floor((now - t) / DAY_MS)
  return left >= 0 ? left : null
}

export function hotLead(lead: HotLeadInput, closedSlugs: Set<string>, now = Date.now()): { reason: HotReason; daysLeft: number } | null {
  if (closedSlugs.has(lead.status)) return null
  const byPerception = lead.temperature === 'muito_interessado' || lead.temperature === 'interessado'
    ? daysLeft(lead.situation_updated_at, now) : null
  const byProposal = lead.status === 'proposta' ? daysLeft(lead.stage_changed_at, now) : null
  if (byPerception == null && byProposal == null) return null
  const left = Math.max(byPerception ?? -1, byProposal ?? -1)
  const reason: HotReason = byPerception != null && lead.temperature === 'muito_interessado' ? 'quer_fechar'
    : byProposal != null ? 'proposta'
      : 'interessado'
  return { reason, daysLeft: left }
}
