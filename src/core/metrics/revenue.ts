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

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100
export type PaymentRowWithClient = PaymentRow & { client_id: string; numero_semana?: number }

// Agrupa receita recebida (não anulada, no período) por uma dimensão do cliente (vendedor/plano). FONTE ÚNICA
// da quebra — antes vivia inline no CommercialMetricsService.bySeller. `dim` mapeia client_id → rótulo.
function receivedRevenueByDimension(
  payments: PaymentRowWithClient[], dim: Map<string, string>, fallback: string, fromYMD: string, toYMD: string,
): { label: string; value: number; count: number }[] {
  const agg = new Map<string, { value: number; clients: Set<string> }>()
  for (const p of payments) {
    if (p.anulado) continue
    const d = (p.paid_on ?? '').slice(0, 10)
    if (d < fromYMD || d > toYMD) continue
    const label = dim.get(p.client_id) || fallback
    const cur = agg.get(label) ?? { value: 0, clients: new Set<string>() }
    cur.value += Number(p.valor_usd) || 0
    cur.clients.add(p.client_id)
    agg.set(label, cur)
  }
  return Array.from(agg, ([label, x]) => ({ label, value: round2(x.value), count: x.clients.size }))
    .sort((a, b) => b.value - a.value)
}

/** Receita recebida por vendedor (período). clientToSeller: client_id → assigned_name. */
export function receivedRevenueBySeller(payments: PaymentRowWithClient[], clientToSeller: Map<string, string>, fromYMD: string, toYMD: string) {
  return receivedRevenueByDimension(payments, clientToSeller, 'Sem responsável', fromYMD, toYMD)
    .map(x => ({ name: x.label, value: x.value, count: x.count }))
}

/** Receita recebida por plano (período). clientToPlan: client_id → nome do plano. */
export function receivedRevenueByPlan(payments: PaymentRowWithClient[], clientToPlan: Map<string, string>, fromYMD: string, toYMD: string) {
  return receivedRevenueByDimension(payments, clientToPlan, 'Sem plano', fromYMD, toYMD)
    .map(x => ({ plan: x.label, value: x.value, count: x.count }))
}

/** Receita recebida por forma de pagamento (período). clientToForma: client_id → rótulo da forma. */
export function receivedRevenueByForma(payments: PaymentRowWithClient[], clientToForma: Map<string, string>, fromYMD: string, toYMD: string) {
  return receivedRevenueByDimension(payments, clientToForma, 'Não definida', fromYMD, toYMD)
    .map(x => ({ forma: x.label, value: x.value, count: x.count }))
}
