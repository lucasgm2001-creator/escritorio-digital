import type { createClient } from '@/lib/supabase/client'

type SupaClient = ReturnType<typeof createClient>

type WeekRowDb = { id: string; deal_id: string; numero_semana: number; valor_usd: number; paid_on: string; cotacao_usd_brl: number }

export type PayWeekReason = 'frozen' | 'teto' | 'dup' | 'invalid' | 'db'
interface PayDeal { id: string; valorPorSemanaUsd: number; tetoSemanas: number; status: string }

// Próxima semana NÃO paga (1..teto) de um deal; null se cheio OU congelado (não em_andamento).
// Mesma regra que o DealCard usa pra oferecer slots — extraída pra o agente decidir a semana.
export function nextUnpaidWeek(deal: { tetoSemanas: number; status: string }, paidNumbers: number[]): number | null {
  if (deal.status !== 'em_andamento') return null
  const paid = new Set(paidNumbers)
  for (let n = 1; n <= deal.tetoSemanas; n++) if (!paid.has(n)) return n
  return null
}

// Registra UMA semana paga — ÚNICA fonte da regra de dinheiro (só em_andamento, dentro do
// teto, sem duplicar a mesma semana). Reusada pela UI (Comissões) E pelo agente do Hall.
// NÃO cria deal. Congela a cotação `rate` no lançamento.
export async function payWeek(
  supabase: SupaClient, deal: PayDeal, paidNumbers: number[], numero: number, paidOn: string, rate: number,
): Promise<{ ok: boolean; reason?: PayWeekReason; message?: string; row?: WeekRowDb }> {
  if (deal.status !== 'em_andamento') return { ok: false, reason: 'frozen' }
  if (!Number.isInteger(numero) || numero < 1 || numero > deal.tetoSemanas) return { ok: false, reason: 'invalid' }
  if (paidNumbers.includes(numero)) return { ok: false, reason: 'dup' }
  const { data, error } = await supabase.from('weekly_payments').insert({
    deal_id: deal.id, numero_semana: numero, valor_usd: deal.valorPorSemanaUsd, paid_on: paidOn, cotacao_usd_brl: rate,
  }).select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').single()
  if (error || !data) return { ok: false, reason: 'db', message: error?.message }
  return { ok: true, row: data as WeekRowDb }
}

// Mensagem padronizada do porquê uma semana não pôde ser registrada (UI e agente).
export function payWeekMessage(reason: PayWeekReason | undefined, dbMessage?: string): string {
  switch (reason) {
    case 'frozen':  return 'Venda interrompida/concluída — não dá pra registrar mais semanas.'
    case 'teto':    return 'Esta venda já tem todas as semanas pagas.'
    case 'dup':     return 'Essa semana já está registrada.'
    case 'invalid': return 'Número de semana inválido.'
    default:        return `Não foi possível registrar a semana${dbMessage ? `: ${dbMessage}` : ''}.`
  }
}

// Registra uma reunião (US$15 padrão). Retorna o builder do supabase → encaixa no useSave
// da UI e no `await` direto do agente. MESMA escrita. Congela a cotação `rate`.
export function registerMeeting(
  supabase: SupaClient, sellerId: string,
  m: { metOn: string; valorUsd: number; clientId?: string | null; clientName?: string | null; note?: string | null }, rate: number,
) {
  return supabase.from('meetings').insert({
    seller_id: sellerId, met_on: m.metOn, valor_usd: m.valorUsd, cotacao_usd_brl: rate,
    client_id: m.clientId ?? null, client_name: m.clientName ?? null, note: m.note ?? null,
  }).select('id, seller_id, met_on, valor_usd, cotacao_usd_brl, client_name').single()
}

// Atualiza campos de um cliente. MESMA escrita da UI de Clientes (retorna o builder).
// NUNCA deleta — não há função de exclusão aqui de propósito.
export function updateClient(
  supabase: SupaClient, id: string,
  patch: Record<string, string | number | null>,
) {
  return supabase.from('clients').update(patch).eq('id', id)
}
