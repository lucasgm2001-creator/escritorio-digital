// Primitivos PUROS da CARTEIRA (MRR/ARR, clientes ativos/novos) — EXECUTIVE-METRICS-001. Sem banco, sem React.
// MRR depende da carteira ATIVA (não do que entrou no mês). Convenção do sistema: valor mensal = valor semanal
// × 4 (migration 049: plans.valor_mensal = 4× valor_semanal; mesma base do SuperAgent.verificarMRR). plan_weekly
// é o valor SEMANAL do cliente (custom ou do plano). ARR = MRR × 12 (fonte única).

export const MONTH_WEEKS = 4

export type PortfolioClient = {
  status: string | null
  plan_weekly: number | null
  plano_id?: string | null
  start_date?: string | null
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100
const weekly = (c: PortfolioClient): number => Number(c.plan_weekly) || 0
export const isActiveClient = (c: PortfolioClient): boolean => c.status === 'ativo'

/** Receita mensal recorrente de um cliente = valor semanal × 4. */
export function monthlyRecurring(c: PortfolioClient): number {
  return weekly(c) * MONTH_WEEKS
}

/** MRR (USD) = soma da recorrência mensal dos clientes ATIVOS. */
export function mrr(clients: PortfolioClient[]): number {
  return round2(clients.filter(isActiveClient).reduce((s, c) => s + monthlyRecurring(c), 0))
}

/** ARR (USD) = MRR × 12. */
export function arr(mrrValue: number): number {
  return round2(mrrValue * 12)
}

/** Clientes ativos (contagem). */
export function activeClientsCount(clients: PortfolioClient[]): number {
  return clients.filter(isActiveClient).length
}

/** Clientes novos no período: viraram cliente (start_date) dentro de [fromYMD, toYMD]. ESTRITO — nunca created_at. */
export function newClientsCount(clients: PortfolioClient[], fromYMD: string, toYMD: string): number {
  return clients.filter(c => {
    const d = (c.start_date ?? '').slice(0, 10)
    return !!d && d >= fromYMD && d <= toYMD
  }).length
}

/** MRR por plano (carteira ativa). planName: plano_id → nome. */
export function mrrByPlan(clients: PortfolioClient[], planName: Map<string, string>): { plan: string; mrr: number; count: number }[] {
  const agg = new Map<string, { mrr: number; count: number }>()
  for (const c of clients) {
    if (!isActiveClient(c)) continue
    const label = (c.plano_id && planName.get(c.plano_id)) || 'Sem plano'
    const cur = agg.get(label) ?? { mrr: 0, count: 0 }
    cur.mrr += monthlyRecurring(c)
    cur.count += 1
    agg.set(label, cur)
  }
  return Array.from(agg, ([plan, x]) => ({ plan, mrr: round2(x.mrr), count: x.count })).sort((a, b) => b.mrr - a.mrr)
}
