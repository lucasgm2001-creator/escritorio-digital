// Apresentação dos pagamentos por PERIODICIDADE (PRODUCT-SPRINT-003, Parte 4). O motor continua SEMPRE semanal
// (client_payments por numero_semana, mesma regra de dinheiro). Aqui só AGRUPAMOS para EXIBIR: semanal = uma
// linha por semana ("Semana 3"); mensal = uma linha por MÊS ("Maio/2026"), somando as semanas cuja competência
// (paid_on) cai naquele mês. Função PURA — reusada no Workspace › Financeiro e na aba Administração › Clientes.
export type PaidPeriodItem = { numeroSemana: number; valorUsd: number; paidOn: string | null; dueOn?: string | null; status?: string; anulado: boolean }

export type PaymentPeriod = {
  key: string            // 'S3' (semanal) | '2026-05' (mensal)
  label: string          // 'Semana 3' | 'Maio/2026'
  valorUsd: number       // soma (mensal = soma das semanas ativas do mês)
  paidOn: string | null  // data do pagamento (mensal = a mais recente do mês)
  anulado: boolean       // semanal: a flag da semana; mensal: true só se o mês inteiro é anulado
  weeks: number          // 1 no semanal; nº de semanas agrupadas no mensal
  status: string
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// 'YYYY-MM' → 'Maio/2026'
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MESES[(m ?? 1) - 1] ?? ym}/${y}`
}

// Transforma as semanas em "períodos de exibição" conforme a periodicidade. Mais recente primeiro.
export function toPaymentPeriods(
  payments: PaidPeriodItem[],
  periodicidade: 'semanal' | 'mensal' | null | undefined,
): PaymentPeriod[] {
  if (periodicidade !== 'mensal') {
    // SEMANAL — uma linha por semana.
    return payments.slice().sort((a, b) => b.numeroSemana - a.numeroSemana).map(p => ({
      key: `S${p.numeroSemana}`, label: `Semana ${p.numeroSemana}`,
      valorUsd: p.valorUsd, paidOn: p.paidOn ?? p.dueOn ?? null, anulado: p.anulado, weeks: 1,
      status: p.status ?? (p.anulado ? 'anulada' : 'paga'),
    }))
  }
  // MENSAL — agrupa por mês da competência (paid_on). Nunca 4 linhas: um "Maio/2026" por mês.
  const byMonth = new Map<string, PaymentPeriod>()
  for (const p of payments) {
    const competenceDate = p.paidOn ?? p.dueOn ?? ''
    const ym = competenceDate.slice(0, 7)
    if (!ym) continue
    const cur = byMonth.get(ym) ?? { key: ym, label: monthLabel(ym), valorUsd: 0, paidOn: null, anulado: true, weeks: 0, status: 'prevista' }
    if (!p.anulado) { cur.valorUsd += p.valorUsd; cur.anulado = false }  // qualquer semana ativa → mês não é anulado
    cur.weeks++
    if (!cur.paidOn || competenceDate > cur.paidOn) cur.paidOn = competenceDate
    const status = p.status ?? (p.anulado ? 'anulada' : 'paga')
    if (status === 'paga' || (status === 'parcial' && cur.status !== 'paga') || !['paga', 'parcial'].includes(cur.status)) cur.status = status
    byMonth.set(ym, cur)
  }
  return Array.from(byMonth.values()).sort((a, b) => (a.key < b.key ? 1 : -1))
}
