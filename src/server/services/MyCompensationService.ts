import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { RequestContext } from '@/server/context/request-context'
import { monthlySummary, nextPayoutProjection, pendingCommission } from '@/lib/commission/calc'
import { meetingCommissionCounts } from '@/lib/commission/constants'
import type { DealKind, DealStatus, DealWithClient, FxConfig, Meeting, MonthlySummary, PendingCommissionResult, SalaryPeriod, WeeklyPayment } from '@/lib/commission/types'
import { dueDateFor } from '@/lib/commission/actions'
import { todaySP, dowOfYmd, addDaysYmd } from '@/lib/date'
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
// PROCEDÊNCIA de cada indicador (COMP-FONTES-001). O card deixa de ser um número solto: cada um carrega as
// LINHAS que o compõem, para o colaborador conferir de onde veio. Regra: indicador de dinheiro RECEBIDO só
// lista o que entrou de fato; indicador de projeção deixa explícito o que ainda não entrou (campo `hint`).
export type CompSourceLine = {
  label: string            // "Venda · semana 3", "Reunião", "Salário fixo", "Bônus de renovação"…
  cliente: string | null
  data: string | null      // YYYY-MM-DD do evento (recebimento, reunião, vencimento)
  valorUsd: number
  hint: string | null      // "recebida" / "vence 29/08" / "3 semanas × US$ 38,00"
}
export type CompSource = {
  key: string
  title: string
  description: string      // o que este número significa, em uma linha
  totalUsd: number
  lines: CompSourceLine[]
  emptyMessage: string
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
  thisWeekUsd: number         // comissão que AINDA FALTA receber e vence nesta semana civil (seg–dom)
  thisWeekRange: { from: string; to: string } | null  // janela usada no cálculo (transparência na UI/PDF)
  status: string              // status do vendedor (ativo/inativo)
  lastUpdate: string | null   // data do último lançamento (última atualização)
  months: CompMonth[]
  pending: PendingCommissionResult  // comissões pendentes das primeiras 4 semanas por cliente (reusa dealTotal)
  forecastMonthUsd: number          // comissão prevista DO MÊS = recebida no mês + pendente que vence no mês
  sources: CompSource[]             // procedência de cada indicador (mesma ordem dos cards)
}

export async function getMyCompensationView(context: RequestContext): Promise<MyCompensationView> {
  const emptyPending: PendingCommissionResult = {
    totalPendenteUsd: 0, totalPagoNasElegiveisUsd: 0, clientesPendentes: 0, clientesCompletos: 0,
    semanasPendentesTotais: 0, lines: [],
  }
  const empty: MyCompensationView = {
    hasComp: false, sellerName: context.profile?.name ?? '', cargo: null, department: null, rule: null,
    currentMonth: null, nextPayout: null, yearReceivedUsd: 0, totalReceivedUsd: 0, dealsCount: 0,
    thisWeekUsd: 0, thisWeekRange: null, status: 'ativo', lastUpdate: null, months: [], pending: emptyPending,
    forecastMonthUsd: 0, sources: [],
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
    supabase.from('deals').select('id, client_id, client_name, valor_total_usd, valor_por_semana_usd, teto_semanas, status, data_fechamento, kind').eq('seller_id', seller.id),
    supabase.from('fx_config').select('cotacao_manual, cotacao_travada, cotacao_referencia').eq('team_id', teamId).maybeSingle(),
    resolveCompensationRule(context, seller.id, today),
  ])

  const salaries: SalaryPeriod[] = (salRes.data ?? []).map(s => ({ sellerId: s.seller_id, valorUsd: Number(s.valor_usd), effectiveFrom: s.effective_from }))
  // Corte (Parte 6): reuniões com competência ≥ JUL/2026 não geram comissão → fora de TUDO em Minha Remuneração
  // (total, linhas por mês, meses com evento, última atualização, PDF). Filtra na FONTE, uma vez só.
  const eligibleMeetings = (mtgRes.data ?? []).filter(m => meetingCommissionCounts(m.met_on))
  const meetings: Meeting[] = eligibleMeetings.map(m => ({ id: m.id, sellerId: m.seller_id, metOn: m.met_on, valorUsd: Number(m.valor_usd), cotacaoUsdBrl: Number(m.cotacao_usd_brl) }))
  const mtgClient = new Map(eligibleMeetings.map(m => [m.id, (m as { client_name: string | null }).client_name]))
  const deals = (dealRes.data ?? []) as { id: string; client_id: string | null; client_name: string | null; valor_total_usd: number; valor_por_semana_usd: number; teto_semanas: number; status: string; data_fechamento: string | null; kind: DealKind }[]
  const dealById = new Map(deals.map(d => [d.id, d]))
  const dealIds = deals.map(d => d.id)

  let weeks: WeeklyPayment[] = []
  if (dealIds.length) {
    // ESTORNO (soft-delete): linha com deleted_at NÃO é comissão — sai da fonte, antes de qualquer cálculo.
    const { data: wk } = await supabase.from('weekly_payments').select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').in('deal_id', dealIds).is('deleted_at', null)
    weeks = (wk ?? []).map(w => ({ id: w.id, dealId: w.deal_id, numeroSemana: w.numero_semana, valorUsd: Number(w.valor_usd), paidOn: w.paid_on, cotacaoUsdBrl: Number(w.cotacao_usd_brl), kind: dealById.get(w.deal_id)?.kind ?? 'sale' }))
  }

  const manual = fxRes.data?.cotacao_manual != null ? Number(fxRes.data.cotacao_manual) : null
  const fx: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fxRes.data?.cotacao_travada }
  // P3-FXREF-001: a cotação automática é `cotacao_referencia`, com o manual só de reserva — a MESMA ordem do
  // resto do sistema (lib/commission/fx). Antes só olhava o manual, então destravar a cotação com o manual
  // vazio zerava TODO o BRL desta tela e do PDF (o USD, moeda base, nunca dependeu disto).
  const referencia = fxRes.data?.cotacao_referencia != null ? Number(fxRes.data.cotacao_referencia) : null
  const automaticRate = referencia ?? manual ?? 0

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

  // Vendas do vendedor no formato do motor (+ nome do cliente p/ exibição). REUSO único p/ "esta semana" e "pendentes".
  const dealsWithClient: DealWithClient[] = deals.map(d => ({
    id: d.id, sellerId: seller.id, valorTotalUsd: Number(d.valor_total_usd), tetoSemanas: Number(d.teto_semanas),
    valorPorSemanaUsd: Number(d.valor_por_semana_usd), status: d.status as DealStatus,
    dataFechamento: d.data_fechamento ?? '', clientName: d.client_name, kind: d.kind ?? 'sale',
  }))
  // Receber esta semana (P1-THISWEEK-001 + P1-THISWEEK-002) — janela de DATA, e só o que FALTA receber.
  // 1ª versão: somava a parcela de toda venda ativa com semanas restantes → repetia o MESMO número toda
  //   semana, entrasse dinheiro ou não (a impressão de "a comissão não anda conforme os dias passam").
  // 2ª versão: passou a somar as semanas cujo VENCIMENTO cai na semana civil corrente (seg–dom, Brasília)
  //   pela régua canônica `dueDateFor` — a mesma do cron e do ClientFinanceService.
  // FALTAVA excluir o que JÁ foi recebido: o card dizia "Receber esta semana US$ 116" com as três semanas
  //   daquele valor já pagas e já contadas em "Comissão do mês". Ficava maior que o "Total pendente"
  //   (116 > 114), o que é impossível. "Receber" é o que ainda vem: semana já paga sai da conta, e assim
  //   este número nunca ultrapassa o total pendente.
  // Deriva do CRONOGRAMA (não das linhas já agendadas), então uma semana que vence na sexta já conta na
  // segunda — o robô só cria a linha no dia do vencimento. Só vendas (kind='sale') em_andamento e só as
  // `tetoSemanas` primeiras semanas geram comissão, exatamente como em save_client_week.
  const todayYmd = todaySP()
  const weekFrom = addDaysYmd(todayYmd, -((dowOfYmd(todayYmd) + 6) % 7))   // segunda-feira da semana corrente
  const weekTo = addDaysYmd(weekFrom, 6)                                    // domingo
  const thisWeekRange = { from: weekFrom, to: weekTo }

  const clientIds = Array.from(new Set(deals.filter(d => d.kind === 'sale' && d.status === 'em_andamento' && d.client_id).map(d => d.client_id as string)))
  // Semanas de comissão JÁ recebidas (estorno já saiu na fonte, acima) — chave `dealId:numeroSemana`.
  const recebidas = new Set(weeks.map(w => `${w.dealId}:${w.numeroSemana}`))
  // Semanas de comissão que AINDA não entraram, com o vencimento de cada uma. Uma varredura só alimenta
  // dois indicadores: "Receber esta semana" (vencimento na semana civil) e "Comissão prevista do mês"
  // (vencimento dentro do mês corrente). Teto é 4, então varrer tudo é trivial.
  const semanasAVencer: { cliente: string | null; numero: number; due: string; valorUsd: number }[] = []
  if (clientIds.length) {
    const { data: cliRows } = await supabase.from('clients')
      .select('id, status, start_date, billing_anchor_date, dia_pagamento_semana')
      .in('id', clientIds).is('deleted_at', null)
    const cliById = new Map((cliRows ?? []).map(c => [c.id as string, c]))
    // 1 comissão por cliente: a venda mais recente (mesmo desempate de save_client_week).
    const dealByClient = new Map<string, typeof deals[number]>()
    for (const d of deals) {
      if (d.kind !== 'sale' || d.status !== 'em_andamento' || !d.client_id) continue
      const cur = dealByClient.get(d.client_id)
      if (!cur || (d.data_fechamento ?? '') > (cur.data_fechamento ?? '')) dealByClient.set(d.client_id, d)
    }
    for (const [clientId, d] of dealByClient) {
      const c = cliById.get(clientId)
      if (!c || c.status !== 'ativo') continue
      const anchor = String(c.billing_anchor_date ?? c.start_date ?? '').slice(0, 10)
      if (!anchor) continue
      const dia = c.dia_pagamento_semana ?? dowOfYmd(anchor)
      const teto = Number(d.teto_semanas)
      for (let n = 1; n <= teto; n++) {
        if (recebidas.has(`${d.id}:${n}`)) continue   // já entrou → não é previsão
        semanasAVencer.push({
          cliente: d.client_name, numero: n,
          due: dueDateFor(anchor, dia, n), valorUsd: Number(d.valor_por_semana_usd),
        })
      }
    }
  }
  const naSemana = semanasAVencer.filter(x => x.due >= weekFrom && x.due <= weekTo)
  const thisWeekUsd = round2(naSemana.reduce((acc, x) => acc + x.valorUsd, 0))
  const thisWeekLines: CompSourceLine[] = naSemana.map(x => ({
    label: `Venda · semana ${x.numero}`, cliente: x.cliente, data: x.due, valorUsd: x.valorUsd, hint: 'a receber',
  }))
  // Comissões pendentes das primeiras 4 semanas, por cliente (mesma matemática do dealTotal — só agregada por venda).
  const pending = pendingCommission(dealsWithClient, weeks)
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
      const origem = w.kind === 'upgrade' ? `Upgrade · parcela ${w.numeroSemana}`
        : w.kind === 'renewal' ? 'Bônus de renovação' : `Venda · semana ${w.numeroSemana}`
      payments.push({ origem, cliente: d?.client_name ?? null, data: w.paidOn, valorUsd: w.valorUsd, valorBrl: round2(w.valorUsd * w.cotacaoUsdBrl), status: d?.status ?? null })
    })
    meetings.filter(mm2 => mm2.metOn.slice(0, 7) === key).forEach(mm2 => {
      payments.push({ origem: 'Reunião', cliente: mtgClient.get(mm2.id) ?? null, data: mm2.metOn, valorUsd: mm2.valorUsd, valorBrl: round2(mm2.valorUsd * mm2.cotacaoUsdBrl), status: null })
    })
    payments.sort((a, b) => (a.data < b.data ? 1 : -1))
    return { key, label: `${MONTH_NAMES[mm - 1]} ${yy}`, summary, payments }
  })

  // ── PROCEDÊNCIA DOS INDICADORES (COMP-FONTES-001) ─────────────────────────────────────────────
  // Deriva das MESMAS listas que produziram os números acima (weeks/meetings/salaries/pending) — nenhum
  // cálculo novo, nenhuma segunda fonte. Se o card e a lista divergissem, seria bug de duplicação.
  const monthKey = `${y}-${pad2(m)}`
  const nomeCliente = (dealId: string) => dealById.get(dealId)?.client_name ?? null
  const rotuloSemana = (w: WeeklyPayment) =>
    w.kind === 'upgrade' ? `Upgrade · parcela ${w.numeroSemana}`
      : w.kind === 'renewal' ? 'Bônus de renovação'
        : `Venda · semana ${w.numeroSemana}`

  // Só o que ENTROU: semana recebida tem paid_on; reunião elegível tem met_on. Ordena do mais recente.
  const recentesPrimeiro = (a: CompSourceLine, b: CompSourceLine) => (b.data ?? '').localeCompare(a.data ?? '')

  const linhasSemanas = (filtro: (w: WeeklyPayment) => boolean): CompSourceLine[] =>
    weeks.filter(filtro).map(w => ({
      label: rotuloSemana(w), cliente: nomeCliente(w.dealId), data: w.paidOn,
      valorUsd: w.valorUsd, hint: 'recebida',
    }))
  const linhasReunioes = (filtro: (mm: Meeting) => boolean): CompSourceLine[] =>
    meetings.filter(filtro).map(mm => ({
      label: 'Reunião', cliente: mtgClient.get(mm.id) ?? null, data: mm.metOn,
      valorUsd: mm.valorUsd, hint: 'recebida',
    }))

  const doMes = [
    ...linhasSemanas(w => w.paidOn.slice(0, 7) === monthKey),
    ...linhasReunioes(mm => mm.metOn.slice(0, 7) === monthKey),
  ].sort(recentesPrimeiro)

  const salarioLinhas: CompSourceLine[] = currentMonth.salaryUsd > 0
    ? [{ label: 'Salário fixo', cliente: null, data: `${monthKey}-01`, valorUsd: currentMonth.salaryUsd,
        hint: currentMonth.salaryBrl > 0 ? `equivale a R$ ${currentMonth.salaryBrl.toFixed(2)}` : null }]
    : []

  // Acumulado por CLIENTE (não linha a linha): com dezenas de semanas, a lista vira ruído. Agrupar responde
  // "de onde veio" melhor do que despejar tudo. Reuniões entram como um bloco só, pelo mesmo motivo.
  const porCliente = new Map<string, { total: number; semanas: number; ultima: string }>()
  for (const w of weeks) {
    const nome = nomeCliente(w.dealId) ?? 'Venda sem cliente'
    const cur = porCliente.get(nome) ?? { total: 0, semanas: 0, ultima: '' }
    cur.total = round2(cur.total + w.valorUsd)
    cur.semanas += 1
    if (w.paidOn > cur.ultima) cur.ultima = w.paidOn
    porCliente.set(nome, cur)
  }
  const ateAgoraLinhas: CompSourceLine[] = Array.from(porCliente, ([nome, v]) => ({
    label: `${v.semanas} semana(s) recebida(s)`, cliente: nome, data: v.ultima, valorUsd: v.total, hint: 'recebida',
  })).sort((a, b) => b.valorUsd - a.valorUsd)
  const totalReunioesUsd = round2(meetings.reduce((acc, mm) => acc + mm.valorUsd, 0))
  if (totalReunioesUsd > 0) {
    ateAgoraLinhas.push({
      label: `${meetings.length} reunião(ões)`, cliente: null,
      data: meetings.map(mm => mm.metOn).sort().at(-1) ?? null,
      valorUsd: totalReunioesUsd, hint: 'recebida',
    })
  }

  // PREVISTO DO MÊS (COMP-PREVISTO-002): "quanto fecho este mês se tudo que vence neste mês for pago".
  // NÃO é acumulado: só o que JÁ entrou no mês somado ao que ainda vence DENTRO do mês. Semana que vence em
  // setembro é previsão de setembro, não de agosto — misturar as duas coisas dava um número que não
  // respondia nenhuma pergunta prática.
  const mesFim = `${monthKey}-31`   // string YMD: '-31' cobre o mês todo na comparação lexicográfica
  const pendenteNoMes = semanasAVencer
    .filter(x => x.due >= `${monthKey}-01` && x.due <= mesFim)
    .sort((a, b) => a.due.localeCompare(b.due))
  const pendenteNoMesUsd = round2(pendenteNoMes.reduce((acc, x) => acc + x.valorUsd, 0))
  const comissaoDoMesUsd = round2(currentMonth.weeksUsd + currentMonth.meetingsUsd)
  const forecastMonthUsd = round2(comissaoDoMesUsd + pendenteNoMesUsd)

  const sources: CompSource[] = [
    { key: 'salario', title: 'Salário fixo', description: `Salário vigente na competência de ${monthKey}.`,
      totalUsd: currentMonth.salaryUsd, lines: salarioLinhas, emptyMessage: 'Nenhum salário fixo configurado.' },
    { key: 'mesComissao', title: 'Comissão do mês', description: 'Somente o que entrou neste mês: semanas recebidas, bônus e reuniões.',
      totalUsd: comissaoDoMesUsd, lines: doMes,
      emptyMessage: 'Nenhuma comissão recebida neste mês ainda.' },
    { key: 'semana', title: 'Receber esta semana', description: `Comissão que ainda falta receber e vence entre ${weekFrom} e ${weekTo}.`,
      totalUsd: thisWeekUsd, lines: thisWeekLines.sort(recentesPrimeiro),
      emptyMessage: 'Tudo que vencia nesta semana já entrou.' },
    { key: 'mesTotal', title: 'Receber este mês', description: 'Salário do mês somado à comissão já recebida nele.',
      totalUsd: currentMonth.totalUsd, lines: [...salarioLinhas, ...doMes],
      emptyMessage: 'Nada lançado neste mês.' },
    { key: 'ateAgora', title: 'Comissão até agora', description: 'Tudo que já foi recebido, do início até hoje, agrupado por cliente.',
      totalUsd: totalReceivedUsd, lines: ateAgoraLinhas,
      emptyMessage: 'Nenhuma comissão recebida ainda.' },
    { key: 'previsto', title: 'Comissão prevista do mês',
      description: 'Quanto fecha este mês se tudo que ainda vence dentro dele for pago.',
      totalUsd: forecastMonthUsd,
      lines: [
        ...doMes,
        ...pendenteNoMes.map(x => ({
          label: `Venda · semana ${x.numero}`, cliente: x.cliente, data: x.due,
          valorUsd: x.valorUsd, hint: 'a receber',
        })),
      ],
      emptyMessage: 'Nada recebido nem previsto para este mês.' },
  ]

  return {
    hasComp: true, sellerName: seller.name, cargo: role?.name ?? null, department: dept?.name ?? null,
    rule, currentMonth, nextPayout, yearReceivedUsd, totalReceivedUsd, dealsCount: deals.filter(d => d.kind === 'sale').length,
    thisWeekUsd, thisWeekRange, status: (seller as { status?: string }).status ?? 'ativo', lastUpdate, months, pending,
    forecastMonthUsd, sources,
  }
}
