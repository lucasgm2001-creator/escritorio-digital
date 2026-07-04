import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { RequestContext } from '@/server/context/request-context'
import { monthlySummary, nextPayoutProjection, dealTotal } from '@/lib/commission/calc'
import type { DealStatus, FxConfig, Meeting, MonthlySummary, SalaryPeriod, WeeklyPayment } from '@/lib/commission/types'
import { resolveCompensationRule, type NormalizedCompensationRule } from '@/server/services/CompensationService'
import { roleByKey, departmentByKey, type DepartmentKey } from '@/lib/people/catalog'

// "Minha Remuneração" do COLABORADOR (COMPENSATION-REAL-001, Parte 6/7/9). SÓ LEITURA e SÓ do próprio: o
// seller é resolvido por sellers.user_id = usuário logado (nunca por parâmetro da UI) → segurança por
// construção, no servidor. REUTILIZA integralmente o motor existente (lib/commission/calc: monthlySummary /
// nextPayoutProjection) e o CompensationService (regra vigente) — NENHUMA engine nova, NENHUM cálculo alterado,
// NENHUM ledger/histórico tocado. As fontes são as mesmas do módulo real (seller_salaries/meetings/deals/
// weekly_payments/fx_config/collaborator_compensation_settings).

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const pad2 = (n: number) => String(n).padStart(2, '0')
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export type CompPaymentLine = {
  origem: string
  cliente: string | null
  data: string
  valorUsd: number
  valorBrl: number
  status: string | null
}
export type CompMonth = {
  key: string
  label: string
  summary: MonthlySummary
  payments: CompPaymentLine[]
}
export type MyCompensationView = {
  hasComp: boolean            // false = usuário não é vendedor / sem seller vinculado → estado honesto
  sellerName: string
  cargo: string | null
  department: string | null
  rule: NormalizedCompensationRule | null   // modelo vigente (fixo + comissões + forma de pagamento)
  currentMonth: MonthlySummary | null
  nextPayout: { date: string; totalUsd: number; totalBrl: number } | null
  yearReceivedUsd: number
  totalReceivedUsd: number
  dealsCount: number
  thisWeekUsd: number         // receber esta semana (parcela semanal das vendas ativas — projeção do motor)
  status: string              // status do vendedor (ativo/inativo)
  lastUpdate: string | null   // data do último lançamento (última atualização)
  months: CompMonth[]
}

export async function getMyCompensationView(context: RequestContext): Promise<MyCompensationView> {
  const empty: MyCompensationView = {
    hasComp: false, sellerName: context.profile?.name ?? '', cargo: null, department: null, rule: null,
    currentMonth: null, nextPayout: null, yearReceivedUsd: 0, totalReceivedUsd: 0, dealsCount: 0,
    thisWeekUsd: 0, status: 'ativo', lastUpdate: null, months: [],
  }
  const teamId = context.activeTeamId
  if (!teamId) return empty
  const supabase = createClient()
  const userId = context.user.id

  // SEGURANÇA: o seller é o do usuário logado. Sem parâmetro da UI → ninguém abre a remuneração de outro.
  const { data: seller } = await supabase.from('sellers').select('id, name, status').eq('user_id', userId).eq('team_id', teamId).maybeSingle()
  if (!seller) return empty

  // Cargo/departamento reais (team_members RH — migration 044), resolvidos no catálogo oficial.
  const { data: rh } = await supabase.from('team_members').select('role_key, department_key').eq('team_id', teamId).eq('user_id', userId).maybeSingle()
  const role = rh?.role_key ? roleByKey(rh.role_key) : undefined
  const deptKey = (rh?.department_key ?? role?.department) as DepartmentKey | undefined
  const dept = deptKey ? departmentByKey(deptKey) : undefined

  const today = new Date().toISOString().slice(0, 10)
  const [salRes, mtgRes, dealRes, fxRes, rule] = await Promise.all([
    supabase.from('seller_salaries').select('seller_id, valor_usd, effective_from').eq('seller_id', seller.id),
    supabase.from('meetings').select('id, seller_id, met_on, valor_usd, cotacao_usd_brl, client_name').eq('seller_id', seller.id),
    supabase.from('deals').select('id, client_name, valor_total_usd, valor_por_semana_usd, teto_semanas, status, data_fechamento').eq('seller_id', seller.id),
    supabase.from('fx_config').select('cotacao_manual, cotacao_travada').eq('team_id', teamId).maybeSingle(),
    resolveCompensationRule(context, seller.id, today),
  ])

  const salaries: SalaryPeriod[] = (salRes.data ?? []).map(s => ({ sellerId: s.seller_id, valorUsd: Number(s.valor_usd), effectiveFrom: s.effective_from }))
  const meetings: Meeting[] = (mtgRes.data ?? []).map(m => ({ id: m.id, sellerId: m.seller_id, metOn: m.met_on, valorUsd: Number(m.valor_usd), cotacaoUsdBrl: Number(m.cotacao_usd_brl) }))
  const mtgClient = new Map((mtgRes.data ?? []).map(m => [m.id, (m as { client_name: string | null }).client_name]))
  const deals = (dealRes.data ?? []) as { id: string; client_name: string | null; valor_total_usd: number; valor_por_semana_usd: number; teto_semanas: number; status: string; data_fechamento: string | null }[]
  const dealById = new Map(deals.map(d => [d.id, d]))
  const dealIds = deals.map(d => d.id)

  let weeks: WeeklyPayment[] = []
  if (dealIds.length) {
    const { data: wk } = await supabase.from('weekly_payments').select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').in('deal_id', dealIds)
    weeks = (wk ?? []).map(w => ({ id: w.id, dealId: w.deal_id, numeroSemana: w.numero_semana, valorUsd: Number(w.valor_usd), paidOn: w.paid_on, cotacaoUsdBrl: Number(w.cotacao_usd_brl) }))
  }

  const manual = fxRes.data?.cotacao_manual != null ? Number(fxRes.data.cotacao_manual) : null
  const fx: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fxRes.data?.cotacao_travada }
  const automaticRate = manual ?? 0

  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1
  const currentMonth = monthlySummary({ year: y, month: m, salaries, meetings, weeks, fx, automaticRate })
  const np = nextPayoutProjection(`${y}-${pad2(m)}`, { salaries, meetings, weeks, fx, automaticRate })
  const nextPayout = { date: np.proximoPagamento, totalUsd: np.summary.totalUsd, totalBrl: np.summary.totalBrl }

  // Recebido no ano = soma dos totais mensais (salário + comissão) de janeiro até o mês corrente (mesmo motor).
  let yearReceivedUsd = 0
  for (let mo = 1; mo <= m; mo++) yearReceivedUsd += monthlySummary({ year: y, month: mo, salaries, meetings, weeks, fx, automaticRate }).totalUsd
  yearReceivedUsd = round2(yearReceivedUsd)
  // Comissão acumulada (histórico) = todas as semanas + reuniões já recebidas (sem salário).
  const totalReceivedUsd = round2(weeks.reduce((s, w) => s + w.valorUsd, 0) + meetings.reduce((s, mm) => s + mm.valorUsd, 0))

  // Receber esta semana = parcela semanal das vendas ATIVAS que ainda têm semanas a vencer (reusa dealTotal).
  const thisWeekUsd = round2(deals
    .filter(d => d.status === 'em_andamento')
    .map(d => ({ id: d.id, sellerId: seller.id, valorTotalUsd: Number(d.valor_total_usd), tetoSemanas: Number(d.teto_semanas), valorPorSemanaUsd: Number(d.valor_por_semana_usd), status: d.status as DealStatus, dataFechamento: d.data_fechamento ?? '' }))
    .filter(dl => dealTotal(dl, weeks).semanasRestantes > 0)
    .reduce((s, dl) => s + dl.valorPorSemanaUsd, 0))
  // Última atualização = data do lançamento mais recente (semana paga / reunião).
  const eventDates = [...weeks.map(w => w.paidOn), ...meetings.map(mm => mm.metOn)].filter(Boolean).sort()
  const lastUpdate = eventDates.length ? eventDates[eventDates.length - 1] : null

  // Histórico mês a mês — meses com atividade (semanas/reuniões) + o mês corrente (salário). Até 12 recentes.
  const monthKeys = new Set<string>()
  weeks.forEach(w => monthKeys.add(w.paidOn.slice(0, 7)))
  meetings.forEach(mm => monthKeys.add(mm.metOn.slice(0, 7)))
  monthKeys.add(`${y}-${pad2(m)}`)

  const months: CompMonth[] = Array.from(monthKeys).sort().reverse().slice(0, 12).map(key => {
    const [yy, mm] = key.split('-').map(Number)
    const summary = monthlySummary({ year: yy, month: mm, salaries, meetings, weeks, fx, automaticRate })
    const payments: CompPaymentLine[] = []
    if (summary.salaryUsd > 0) payments.push({ origem: 'Salário fixo', cliente: null, data: `${key}-01`, valorUsd: summary.salaryUsd, valorBrl: summary.salaryBrl, status: null })
    weeks.filter(w => w.paidOn.slice(0, 7) === key).forEach(w => {
      const d = dealById.get(w.dealId)
      payments.push({ origem: `Venda · semana ${w.numeroSemana}`, cliente: d?.client_name ?? null, data: w.paidOn, valorUsd: w.valorUsd, valorBrl: round2(w.valorUsd * w.cotacaoUsdBrl), status: d?.status ?? null })
    })
    meetings.filter(mm2 => mm2.metOn.slice(0, 7) === key).forEach(mm2 => {
      payments.push({ origem: 'Reunião', cliente: mtgClient.get(mm2.id) ?? null, data: mm2.metOn, valorUsd: mm2.valorUsd, valorBrl: round2(mm2.valorUsd * mm2.cotacaoUsdBrl), status: null })
    })
    payments.sort((a, b) => (a.data < b.data ? 1 : -1))
    return { key, label: `${MONTH_NAMES[mm - 1]} ${yy}`, summary, payments }
  })

  return {
    hasComp: true, sellerName: seller.name, cargo: role?.name ?? null, department: dept?.name ?? null,
    rule, currentMonth, nextPayout, yearReceivedUsd, totalReceivedUsd, dealsCount: deals.length,
    thisWeekUsd, status: (seller as { status?: string }).status ?? 'ativo', lastUpdate, months,
  }
}
