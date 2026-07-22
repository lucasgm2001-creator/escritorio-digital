// Primitivos PUROS de VENDAS/CONTRATOS (valor fechado, ticket médio) — EXECUTIVE-METRICS-001. Sem banco/React.
// "Valor fechado" = soma dos CONTRATOS (deals) fechados no período (por data_fechamento). NUNCA é dinheiro
// recebido (isso é core/metrics/revenue — client_payments). Ticket médio = valor fechado ÷ nº de clientes
// conquistados (contratos fechados) no período — indicador COMERCIAL, não financeiro.

export type SaleDeal = { valor_total_usd: number | null; data_fechamento: string | null }

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** Contratos fechados no período (data_fechamento civil em [fromYMD, toYMD]). */
function closedDealsInPeriod<T extends SaleDeal>(deals: T[], fromYMD: string, toYMD: string): T[] {
  return deals.filter(d => { const dt = (d.data_fechamento ?? '').slice(0, 10); return dt >= fromYMD && dt <= toYMD })
}

/** Valor fechado (USD) = soma dos contratos fechados no período. */
export function closedValue(deals: SaleDeal[], fromYMD: string, toYMD: string): number {
  return round2(closedDealsInPeriod(deals, fromYMD, toYMD).reduce((s, d) => s + (Number(d.valor_total_usd) || 0), 0))
}

/** Nº de clientes conquistados (contratos fechados) no período. */
export function closedCount(deals: SaleDeal[], fromYMD: string, toYMD: string): number {
  return closedDealsInPeriod(deals, fromYMD, toYMD).length
}

/** Ticket médio (USD) = valor fechado ÷ nº de contratos fechados. 0 se nenhum fechamento. */
export function averageTicket(closedValueUsd: number, closedCountN: number): number {
  return closedCountN > 0 ? round2(closedValueUsd / closedCountN) : 0
}
