// Primitivos PUROS de receita — FONTE ÚNICA (EXECUTIVE-DASHBOARD-001, Fase 0). Sem banco, sem React:
// recebem as linhas já carregadas de client_payments e devolvem o número. A "receita recebida" do sistema
// é SEMPRE o ledger client_payments (paid_on, valor_usd) excluindo os anulados — em USD (moeda base).
// Antes desta consolidação a mesma soma vivia copiada em AdminOverviewService e DashboardService.

export type PaymentRow = { valor_usd: number | null; paid_on: string | null; anulado: boolean | null }

/** Soma de client_payments NÃO anulados. Base de toda "receita recebida". */
export function receivedRevenue(payments: PaymentRow[]): number {
  return payments.filter(p => !p.anulado).reduce((s, p) => s + (Number(p.valor_usd) || 0), 0)
}

/** Receita recebida (USD) com paid_on >= sinceYMD (ex.: 1º dia do mês). Não anulados. */
export function receivedRevenueSince(payments: PaymentRow[], sinceYMD: string): number {
  return receivedRevenue(payments.filter(p => (p.paid_on ?? '') >= sinceYMD))
}

/** Receita recebida (USD) num intervalo [fromYMD, toYMD] (civil, inclusivo). Não anulados. */
export function receivedRevenueBetween(payments: PaymentRow[], fromYMD: string, toYMD: string): number {
  return receivedRevenue(payments.filter(p => { const d = p.paid_on ?? ''; return d >= fromYMD && d <= toYMD }))
}
