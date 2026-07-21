// Módulo de Comissão — funções de cálculo PURAS (Fase 1).
// Sem banco, sem React: recebem os dados já carregados e devolvem os números.
// Regras: USD é a moeda real; BRL é exibição. Cada evento conta no mês da sua
// data real (semana=paidOn, reunião=metOn). Histórico imutável via cotação congelada.

import type {
  FxConfig, SalaryPeriod, Meeting, Deal, WeeklyPayment,
  MonthlySummary, DealTotal, NextPayout,
  DealWithClient, PendingClientLine, PendingCommissionResult,
} from './types'
import { meetingCommissionCounts } from './constants'

const pad2 = (n: number) => String(n).padStart(2, '0')
const monthKey = (year: number, month: number) => `${year}-${pad2(month)}`
const inMonth = (dateStr: string, year: number, month: number) => dateStr.slice(0, 7) === monthKey(year, month)
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Cotação a aplicar em conversões NÃO-congeladas (salário, novos registros):
 * se travada e há valor manual, usa a manual; senão, usa a automática informada.
 */
export function resolveRate(fx: FxConfig, automaticRate: number): number {
  return fx.cotacaoTravada && fx.cotacaoManual != null ? fx.cotacaoManual : automaticRate
}

/**
 * Salário vigente para um mês: o período com a maior `effectiveFrom` <= 1º dia do mês.
 * (Comparação de datas ISO 'YYYY-MM-DD' é segura lexicograficamente.)
 */
export function salaryForMonth(salaries: SalaryPeriod[], year: number, month: number): number {
  const firstDay = `${monthKey(year, month)}-01`
  const applicable = salaries
    .filter(s => s.effectiveFrom <= firstDay)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0]
  return applicable ? applicable.valorUsd : 0
}

export interface MonthlyInput {
  year: number
  month: number
  salaries: SalaryPeriod[] // do vendedor
  meetings: Meeting[]      // do vendedor (qualquer mês — a função filtra)
  weeks: WeeklyPayment[]   // do vendedor (qualquer mês — já juntadas via deal)
  fx: FxConfig
  automaticRate: number    // cotação automática vigente (p/ converter o salário)
}

/** Resumo mensal isolado: salário do mês + reuniões (metOn) + semanas recebidas (paidOn). */
export function monthlySummary(input: MonthlyInput): MonthlySummary {
  const { year, month, salaries, meetings, weeks, fx, automaticRate } = input

  const salaryUsd = salaryForMonth(salaries, year, month)
  const rateUsed = resolveRate(fx, automaticRate)
  const salaryBrl = round2(salaryUsd * rateUsed)

  // Reuniões a partir de JUL/2026 não geram comissão (Parte 6) — filtradas do dinheiro na FONTE (calc), então
  // Minha Remuneração, PDF e projeção do próximo pagamento já saem corretos sem tocar em cada consumidor.
  const mtgs = meetings.filter(m => inMonth(m.metOn, year, month) && meetingCommissionCounts(m.metOn))
  const meetingsUsd = round2(mtgs.reduce((s, m) => s + m.valorUsd, 0))
  const meetingsBrl = round2(mtgs.reduce((s, m) => s + m.valorUsd * m.cotacaoUsdBrl, 0))

  const wks = weeks.filter(w => inMonth(w.paidOn, year, month))
  const weeksUsd = round2(wks.reduce((s, w) => s + w.valorUsd, 0))
  const weeksBrl = round2(wks.reduce((s, w) => s + w.valorUsd * w.cotacaoUsdBrl, 0))
  const sales = wks.filter(w => w.kind === 'sale')
  const upgrades = wks.filter(w => w.kind === 'upgrade')
  const renewals = wks.filter(w => w.kind === 'renewal')
  const sumUsd = (rows: WeeklyPayment[]) => round2(rows.reduce((s, w) => s + w.valorUsd, 0))
  const sumBrl = (rows: WeeklyPayment[]) => round2(rows.reduce((s, w) => s + w.valorUsd * w.cotacaoUsdBrl, 0))

  return {
    year, month,
    salaryUsd,
    meetingsCount: mtgs.length, meetingsUsd,
    weeksCount: wks.length, weeksUsd,
    salesWeeksCount: sales.length, salesCommissionUsd: sumUsd(sales),
    upgradeBonusUsd: sumUsd(upgrades), renewalBonusUsd: sumUsd(renewals),
    totalUsd: round2(salaryUsd + meetingsUsd + weeksUsd),
    rateUsed,
    salaryBrl, meetingsBrl, weeksBrl,
    salesCommissionBrl: sumBrl(sales), upgradeBonusBrl: sumBrl(upgrades), renewalBonusBrl: sumBrl(renewals),
    totalBrl: round2(salaryBrl + meetingsBrl + weeksBrl),
  }
}

/**
 * Total de uma venda considerando o status:
 *  - em_andamento: soma o recebido + projeta as semanas que faltam até o teto.
 *  - interrompido/concluido: congela só no que foi pago (sem projeção).
 */
export function dealTotal(deal: Deal, weeks: WeeklyPayment[]): DealTotal {
  const pagas = weeks.filter(w => w.dealId === deal.id)
  const semanasPagas = pagas.length
  const recebidoUsd = round2(pagas.reduce((s, w) => s + w.valorUsd, 0))
  const recebidoBrl = round2(pagas.reduce((s, w) => s + w.valorUsd * w.cotacaoUsdBrl, 0))

  const congelado = deal.status !== 'em_andamento'
  const semanasRestantes = congelado ? 0 : Math.max(0, deal.tetoSemanas - semanasPagas)
  const projetadoRestanteUsd = round2(semanasRestantes * deal.valorPorSemanaUsd)
  const totalProjetadoUsd = round2(recebidoUsd + projetadoRestanteUsd)

  return {
    dealId: deal.id, status: deal.status,
    semanasPagas, semanasRestantes,
    recebidoUsd, projetadoRestanteUsd, totalProjetadoUsd,
    recebidoBrl, congelado,
  }
}

/**
 * Projeção do próximo dia 1º: paga o acumulado do mês de `refDate`
 * (salário do mês + reuniões + semanas recebidas até agora). O pagamento
 * cai no 1º dia do mês seguinte ao de refDate.
 */
export function nextPayoutProjection(
  refDate: string,
  input: Omit<MonthlyInput, 'year' | 'month'>,
): NextPayout {
  const [y, m] = refDate.split('-').map(Number)
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y
  const proximoPagamento = `${monthKey(nextYear, nextMonth)}-01`
  const summary = monthlySummary({ ...input, year: y, month: m })
  return { proximoPagamento, refYear: y, refMonth: m, summary }
}

/**
 * Comissões PENDENTES das primeiras `tetoSemanas` (4) semanas de cada cliente (SELLER-COMMISSION-PENDING-001).
 * NÃO é regra nova: cada linha deriva de `dealTotal` (mesma matemática de semanas pagas × restantes já usada em
 * "Por cliente" e "Receber esta semana"). Só AGREGA por cliente e classifica a situação p/ exibir.
 *  - pendente : em_andamento e ainda faltam semanas (semanasRestantes > 0) → projeta o que falta.
 *  - completo : já pagou as `tetoSemanas` (semanasPagas ≥ teto).
 *  - encerrado: venda congelada (interrompido/concluído) antes de completar as 4 → não gera mais (0 pendente).
 * Clientes SEM comissão (Daniel/owner) não têm deal, então nem entram aqui. Soft-deleted já sai na fonte (RLS).
 */
export function pendingCommission(deals: DealWithClient[], weeks: WeeklyPayment[]): PendingCommissionResult {
  const lines: PendingClientLine[] = deals.filter(d => d.kind === 'sale').map(d => {
    const dt = dealTotal(d, weeks) // REUSO — semanasPagas / semanasRestantes / recebidoUsd / projetadoRestanteUsd
    const situacao: PendingClientLine['situacao'] =
      dt.semanasPagas >= d.tetoSemanas ? 'completo'
        : dt.semanasRestantes > 0 ? 'pendente'
          : 'encerrado'
    return {
      dealId: d.id,
      clientName: d.clientName,
      dataFechamento: d.dataFechamento,
      status: d.status,
      situacao,
      semanasElegiveis: d.tetoSemanas,
      semanasPagas: dt.semanasPagas,
      semanasPendentes: dt.semanasRestantes,
      comissaoPorSemanaUsd: d.valorPorSemanaUsd,
      comissaoPagaUsd: dt.recebidoUsd,
      comissaoPendenteUsd: dt.projetadoRestanteUsd,
      valorTotalUsd: round2(d.tetoSemanas * d.valorPorSemanaUsd),
      proximaSemana: situacao === 'pendente' ? dt.semanasPagas + 1 : null,
    }
  })

  // Ordena: pendentes primeiro (as com menos semanas pagas no topo), depois encerrados, depois completos.
  const rank = (s: PendingClientLine['situacao']) => (s === 'pendente' ? 0 : s === 'encerrado' ? 1 : 2)
  lines.sort((a, b) =>
    rank(a.situacao) - rank(b.situacao) ||
    a.semanasPagas - b.semanasPagas ||
    (a.clientName ?? '').localeCompare(b.clientName ?? ''))

  const pendentes = lines.filter(l => l.situacao === 'pendente')
  return {
    totalPendenteUsd: round2(pendentes.reduce((s, l) => s + l.comissaoPendenteUsd, 0)),
    totalPagoNasElegiveisUsd: round2(lines.reduce((s, l) => s + l.comissaoPagaUsd, 0)),
    clientesPendentes: pendentes.length,
    clientesCompletos: lines.filter(l => l.situacao === 'completo').length,
    semanasPendentesTotais: pendentes.reduce((s, l) => s + l.semanasPendentes, 0),
    lines,
  }
}
