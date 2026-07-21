// Camada PURA da tela de Comissão (SPRINT-FINAL-002, Parte 2) — extraída do CommissionSection para separar
// formato/mapeamento do componente. Sem React/estado: formatação de data, cores de status e mapeadores
// DB(snake)→cálculo(camel). Movido VERBATIM (comportamento idêntico). Reusável por CommissionSection e pelos
// sub-componentes de lançamento (DealCard/MeetingRow), que passam a importar daqui.
import type { Deal, DealKind, DealStatus, Meeting, WeeklyPayment } from '@/lib/commission/types'

export const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'
export const inputSm = 'bg-bento-bg border border-bento-border rounded-btn px-2 py-1 text-[11px] text-bento-text focus:outline-none focus:border-lime'

export const pad2 = (n: number) => String(n).padStart(2, '0')
export const monthName = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
export const fmtMonthYear = (iso: string) => { const [y, m] = iso.split('-'); return `${m}/${y}` }
export const fmtDayMonth = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }
export const fmtDayMonthYear = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

// Cotação de último caso (regra 5) e rótulo de origem da cotação em uso (status visível).
export const FX_FALLBACK = 5.40
export function fxSourceMeta(source: string | undefined): { text: string; warn: boolean } {
  if (source === 'manual') return { text: 'manual (travada)', warn: true }
  if (source === 'fallback') return { text: 'fallback — não atualizada hoje, confira', warn: true }
  if (source === 'auto') return { text: 'automática (hoje)', warn: false }
  return { text: 'automática', warn: false }
}

// Cor SÓ pra status (cor = significado): concluído verde, andamento neutro, interrompido vermelho.
export const CLIENT_STATUS: Record<DealStatus, { label: string; cls: string; bar: string }> = {
  em_andamento: { label: 'em andamento', cls: 'border-bento-border text-bento-muted', bar: 'bg-bento-muted' },
  concluido:    { label: 'concluído',    cls: 'border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10', bar: 'bg-[#22C55E]' },
  interrompido: { label: 'interrompido', cls: 'border-red-400/40 text-red-400 bg-red-400/10', bar: 'bg-red-400' },
}
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
// Soma dias a uma data 'YYYY-MM-DD' (aritmética local, segura p/ data pura).
export const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
}

export const STATUS_CLS: Record<DealStatus, string> = {
  em_andamento: 'bg-bento-panel text-bento-dim border-bento-border',
  interrompido: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
  concluido:    'bg-lime/15 text-lime-fg border-lime/30',
}

export type DealUI = Deal & { clientName: string | null }
export type MeetingUI = Meeting & { clientName: string | null }

// ── mapeadores DB (snake) → tipos do cálculo (camel) ──────────────────────────
export const toDealUI = (r: { id: string; seller_id: string; client_name: string | null; valor_total_usd: number; teto_semanas: number; valor_por_semana_usd: number; status: DealStatus; data_fechamento: string; kind?: DealKind }): DealUI => ({
  id: r.id, sellerId: r.seller_id, clientName: r.client_name,
  valorTotalUsd: Number(r.valor_total_usd), tetoSemanas: r.teto_semanas,
  valorPorSemanaUsd: Number(r.valor_por_semana_usd), status: r.status, dataFechamento: r.data_fechamento, kind: r.kind ?? 'sale',
})
export const toWeek = (r: { id: string; deal_id: string; numero_semana: number; valor_usd: number; paid_on: string; cotacao_usd_brl: number }, kind: DealKind = 'sale'): WeeklyPayment => ({
  id: r.id, dealId: r.deal_id, numeroSemana: r.numero_semana, valorUsd: Number(r.valor_usd), paidOn: r.paid_on, cotacaoUsdBrl: Number(r.cotacao_usd_brl), kind,
})
export const toMeeting = (r: { id: string; seller_id: string; met_on: string; valor_usd: number; cotacao_usd_brl: number; client_name: string | null }): MeetingUI => ({
  id: r.id, sellerId: r.seller_id, metOn: r.met_on, valorUsd: Number(r.valor_usd), cotacaoUsdBrl: Number(r.cotacao_usd_brl), clientName: r.client_name,
})
