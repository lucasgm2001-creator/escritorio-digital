import type { createClient } from '@/lib/supabase/client'
import { weeklyCommissionUsd, hasCommissionPct, LEGACY_VPS_USD, DEFAULT_TETO_SEMANAS } from '@/lib/commission/planCommission'
import { meetingCommissionCounts } from '@/lib/commission/constants'

type SupaClient = ReturnType<typeof createClient>

// FIX-P0-TEAMID-WRITES: carimba team_id no payload SÓ quando a equipe ativa é conhecida (client). Sem ela
// (ex.: rotas de servidor/service-role), volta ao comportamento atual (deixa o trigger set_team_id_default
// resolver). A RLS (team_scope) continua sendo a autoridade — isto só evita gravar team_id NULL no multi-equipe.
const withTeam = (teamId: string | null | undefined) => (teamId ? { team_id: teamId } : {})

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
  teamId?: string | null,
): Promise<{ ok: boolean; reason?: PayWeekReason; message?: string; row?: WeekRowDb }> {
  if (deal.status !== 'em_andamento') return { ok: false, reason: 'frozen' }
  if (!Number.isInteger(numero) || numero < 1 || numero > deal.tetoSemanas) return { ok: false, reason: 'invalid' }
  if (paidNumbers.includes(numero)) return { ok: false, reason: 'dup' }
  const { data, error } = await supabase.from('weekly_payments').insert({
    deal_id: deal.id, numero_semana: numero, valor_usd: deal.valorPorSemanaUsd, paid_on: paidOn, cotacao_usd_brl: rate,
    ...withTeam(teamId),
  }).select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').single()
  if (error) {
    // 23505 = índice único uq_weekly_payments_deal_semana (deal_id, numero_semana):
    // corrida de 2 cliques / paidNumbers desatualizado → a semana já existe no banco.
    // Vira mensagem amigável ('dup') em vez de estourar o erro cru na tela.
    if (error.code === '23505') return { ok: false, reason: 'dup' }
    return { ok: false, reason: 'db', message: error.message }
  }
  if (!data) return { ok: false, reason: 'db' }
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
  m: { metOn: string; valorUsd: number; clientId?: string | null; clientName?: string | null; note?: string | null; leadId?: string | null }, rate: number,
  teamId?: string | null,
) {
  return supabase.from('meetings').insert({
    seller_id: sellerId, met_on: m.metOn, valor_usd: m.valorUsd, cotacao_usd_brl: rate,
    client_id: m.clientId ?? null, client_name: m.clientName ?? null, note: m.note ?? null, lead_id: m.leadId ?? null,
    ...withTeam(teamId),
  }).select('id, seller_id, met_on, valor_usd, cotacao_usd_brl, client_name').single()
}

// ─── Comissão nova (incremento 2): pagamento parte do CLIENTE → receita + comissão derivada ───

// Valor semanal do cliente (snapshot): plano (plans.valor_semanal) → plan_weekly → 140 (padrão).
export async function resolveClientPlan(
  supabase: SupaClient, clientId: string,
): Promise<{ planoId: string | null; valorUsd: number }> {
  const { data: cli } = await supabase.from('clients').select('plano_id, plan_weekly').eq('id', clientId).is('deleted_at', null).maybeSingle()
  const planoId: string | null = (cli?.plano_id as string | null) ?? null
  let valor = Number(cli?.plan_weekly) || 0
  if (planoId) {
    const { data: pl } = await supabase.from('plans').select('valor_semanal').eq('id', planoId).maybeSingle()
    if (pl?.valor_semanal != null) valor = Number(pl.valor_semanal)
  }
  if (!valor || valor <= 0) valor = 140 // padrão p/ não quebrar (cliente sem plano)
  return { planoId, valorUsd: valor }
}

export type CommissionOutcome = 'paid' | 'capped' | 'no_deal' | 'dup' | 'frozen' | 'error'

// Deriva a semana de comissão a partir da semana paga do cliente — pelo MESMO payWeek
// (US$25, teto 4, trava). NÃO muda a regra; só decide SE chama e com quais paidNumbers.
async function deriveCommission(
  supabase: SupaClient, clientId: string, numero: number, paidOn: string, rate: number, teamId?: string | null,
): Promise<CommissionOutcome> {
  const { data: deals } = await supabase.from('deals')
    .select('id, valor_por_semana_usd, teto_semanas, status')
    .eq('client_id', clientId).eq('status', 'em_andamento').order('data_fechamento', { ascending: false }).limit(1)
  const deal = deals?.[0]
  if (!deal) return 'no_deal'
  if (numero > deal.teto_semanas) return 'capped'
  const { data: wk } = await supabase.from('weekly_payments').select('numero_semana').eq('deal_id', deal.id)
  const paidNumbers = (wk ?? []).map(w => w.numero_semana as number)
  const res = await payWeek(
    supabase,
    { id: deal.id, valorPorSemanaUsd: Number(deal.valor_por_semana_usd), tetoSemanas: deal.teto_semanas, status: deal.status },
    paidNumbers, numero, paidOn, rate, teamId,
  )
  if (res.ok) return 'paid'
  if (res.reason === 'dup') return 'dup'
  if (res.reason === 'frozen') return 'frozen'
  return 'error'
}

// Registra a semana N paga DO CLIENTE: RECEITA (valor do plano, SEM teto) + deriva a comissão.
// Fonte única do fluxo novo — reusa payWeek (mantém trava/regra/números). Receita idempotente
// (unique client_id+numero_semana → 'dup'). A comissão é derivada mesmo em 'dup' (auto-corrige).
export async function payClientWeek(
  supabase: SupaClient, clientId: string, numero: number, paidOn: string, rate: number, teamId?: string | null,
): Promise<{ ok: boolean; reason?: 'dup' | 'invalid' | 'db'; message?: string; valorUsd?: number; commission?: CommissionOutcome }> {
  if (!Number.isInteger(numero) || numero < 1) return { ok: false, reason: 'invalid' }
  const { planoId, valorUsd } = await resolveClientPlan(supabase, clientId)

  const { error } = await supabase.from('client_payments').insert({
    client_id: clientId, numero_semana: numero, valor_usd: valorUsd, paid_on: paidOn, cotacao_usd_brl: rate, plano_id: planoId,
    ...withTeam(teamId),
  })
  let dup = false
  let derivRate = rate
  if (error) {
    if (error.code === '23505') {
      dup = true
      // M3: a receita JÁ existe com uma cotação CONGELADA. A comissão da MESMA semana tem que usar a MESMA
      // cotação da receita (não o `rate` novo) p/ o BRL bater nas duas pontas. USD não muda; nada gravado recalcula.
      const { data: existing } = await supabase.from('client_payments')
        .select('cotacao_usd_brl').eq('client_id', clientId).eq('numero_semana', numero).maybeSingle()
      if (existing?.cotacao_usd_brl != null) derivRate = Number(existing.cotacao_usd_brl)
    }
    else return { ok: false, reason: 'db', message: error.message }
  }

  const commission = await deriveCommission(supabase, clientId, numero, paidOn, derivRate, teamId)
  if (dup) return { ok: false, reason: 'dup', commission, valorUsd }
  return { ok: true, valorUsd, commission }
}

// ── Date-gating do auto: marca SÓ as semanas cuja DATA REAL de vencimento já chegou ──
const spToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // YYYY-MM-DD (Brasília)
const dowOfYmd = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() } // 0=Dom..6=Sáb (data civil, sem fuso)
const addDaysYmd = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10)
}
// due_date(n) = n-ésima ocorrência do dia de pagamento a partir do start_date (semana 1 = 1º pagamento; +7/sem).
export function dueDateFor(startYmd: string, diaPagamento: number, n: number): string {
  const offset = (((diaPagamento - dowOfYmd(startYmd)) % 7) + 7) % 7
  return addDaysYmd(startYmd, offset + 7 * (n - 1))
}

// Marca as semanas VENCIDAS até hoje (paid_on = DATA REAL da semana), via payClientWeek (receita +
// comissão derivada). NUNCA marca semana futura. Anuladas ocupam o número → não re-marca. Inativo congela.
export async function payDueWeeks(
  supabase: SupaClient, clientId: string, rate: number, maxWeeks = 12, teamId?: string | null,
): Promise<{ marked: number[]; reason: string }> {
  const { data: cli } = await supabase.from('clients').select('status, start_date, dia_pagamento_semana').eq('id', clientId).is('deleted_at', null).maybeSingle()
  if (!cli) return { marked: [], reason: 'nao_encontrado' }
  if (cli.status !== 'ativo') return { marked: [], reason: 'inativo' }
  if (!cli.start_date) return { marked: [], reason: 'sem_inicio' }
  const start = String(cli.start_date).slice(0, 10)
  const dia = cli.dia_pagamento_semana ?? dowOfYmd(start)
  const today = spToday()

  const { data: cps } = await supabase.from('client_payments').select('numero_semana').eq('client_id', clientId)
  const registered = new Set((cps ?? []).map(r => r.numero_semana as number)) // inclui anuladas → não re-marca

  const marked: number[] = []
  for (let i = 0; i < maxWeeks; i++) {
    let n = 1; while (registered.has(n)) n++
    const due = dueDateFor(start, dia, n)
    if (due > today) break          // ainda não venceu → para (NUNCA marca futura)
    registered.add(n)               // ocupa n (evita loop mesmo se falhar)
    const res = await payClientWeek(supabase, clientId, n, due, rate, teamId) // paid_on = due (data REAL, não hoje)
    if (res.ok) marked.push(n)
    else if (res.reason !== 'dup') break // erro real → para; 'dup' (corrida) segue
  }
  return { marked, reason: marked.length ? 'ok' : 'nada_vencido' }
}

// ESTORNO auditável e ATÔMICO (M1): chama a função Postgres void_client_week (SECURITY DEFINER) que, numa
// ÚNICA transação, ANULA a receita (flags anulado/anulado_em/anulado_motivo em client_payments, SEM delete) e
// REMOVE a comissão derivada da semana (DELETE da weekly_payment do deal mais recente). Mesma semântica/colunas
// de antes, agora sem janela de inconsistência (crash no meio reverte tudo). calc.ts intacto (a linha some).
export async function voidClientWeek(
  supabase: SupaClient, clientId: string, numero: number, motivo?: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('void_client_week', {
    p_client_id: clientId, p_numero_semana: numero, p_motivo: motivo ?? null,
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// Garante o vínculo do deal ao cliente: ACHA por nome (case-insensitive) ou CRIA. Evita o deal
// órfão (client_id null), que quebra a derivação da comissão. Retorna null SÓ se faltar nome ou
// a criação falhar → o chamador então NÃO deve criar o deal.
export async function ensureClient(
  supabase: SupaClient, name: string, extra?: { assignedName?: string | null }, teamId?: string | null,
): Promise<string | null> {
  const nm = (name ?? '').trim()
  if (!nm) return null
  const { data: existing } = await supabase.from('clients').select('id, status').ilike('name', nm).is('deleted_at', null).limit(1)
  if (existing && existing.length) {
    if (existing[0].status !== 'ativo') await supabase.from('clients').update({ status: 'ativo' }).eq('id', existing[0].id)
    return existing[0].id
  }
  const { data: nc, error } = await supabase.from('clients').insert({
    name: nm, plan_weekly: 0, status: 'ativo', assigned_name: extra?.assignedName ?? null,
    start_date: new Date().toISOString(),
    ...withTeam(teamId),
  }).select('id').single()
  if (error || !nc) { console.error('[ensureClient] falha ao criar cliente', { name: nm, error: error?.message }); return null }
  return nc.id
}

// ─── Reconstrução histórica (CLIENT-HISTORY-F1) ──────────────────────────────────────────────
// Coloca TODAS as semanas do cliente na DATA HISTÓRICA real, a partir do start_date já gravado.
// NÃO cria motor novo nem muda regra de dinheiro: reusa dueDateFor + payDueWeeks + payWeek/calc.
//   (1) alinha data_fechamento do deal ao start_date (a "venda" fechou quando o cliente entrou);
//   (2) RE-DATA semanas ativas já registradas cuja paid_on ≠ vencimento real — corrige a semana
//       carimbada "hoje" na criação (won-flow). USD e cotação INTOCADOS: só a COMPETÊNCIA corrige,
//       então nada é "recalculado" (o valor gravado é o mesmo; muda só o mês em que ele cai);
//   (3) faz o backfill das semanas vencidas que faltam via payDueWeeks (receita + comissão derivada,
//       teto do deal respeitado, paid_on = vencimento). Idempotente (repetir não duplica).
// Comissão respeita o teto_semanas do deal (regra existente): recebe todas as semanas vencidas,
// mas a comissão só é derivada dentro do teto — igual ao fluxo normal. Requer um deal em_andamento
// para gerar comissão; sem deal, reconstrói só a receita e sinaliza (hadDeal=false).
export async function reconstructClientHistory(
  supabase: SupaClient, clientId: string, rate: number, teamId?: string | null,
): Promise<{ ok: boolean; reason?: string; redated: number; marked: number[]; dueCount: number; hadDeal: boolean }> {
  const empty = { redated: 0, marked: [] as number[], dueCount: 0, hadDeal: false }
  const { data: cli } = await supabase.from('clients').select('status, start_date, dia_pagamento_semana').eq('id', clientId).is('deleted_at', null).maybeSingle()
  if (!cli) return { ok: false, reason: 'nao_encontrado', ...empty }
  if (cli.status !== 'ativo') return { ok: false, reason: 'inativo', ...empty }
  if (!cli.start_date) return { ok: false, reason: 'sem_inicio', ...empty }
  const start = String(cli.start_date).slice(0, 10)
  const dia = cli.dia_pagamento_semana ?? dowOfYmd(start)
  const today = spToday()

  // Semanas vencidas de start_date até hoje (vencimentos monotônicos → para no 1º futuro).
  let dueCount = 0
  for (let n = 1; n <= 520; n++) { if (dueDateFor(start, dia, n) <= today) dueCount = n; else break }

  // Deal atual (o MESMO que a derivação de comissão usa): alinha data_fechamento ao início histórico.
  const { data: deals } = await supabase.from('deals')
    .select('id, data_fechamento, status').eq('client_id', clientId).eq('status', 'em_andamento')
    .order('data_fechamento', { ascending: false }).limit(1)
  const deal = deals?.[0]
  const hadDeal = !!deal
  if (deal && String(deal.data_fechamento ?? '').slice(0, 10) > start) {
    let dq = supabase.from('deals').update({ data_fechamento: start }).eq('id', deal.id)
    if (teamId) dq = dq.eq('team_id', teamId)
    await dq
  }

  // RE-DATA as semanas ATIVAS cuja data ≠ vencimento real (corrige a semana carimbada "hoje").
  // USD/cotação preservados — muda só paid_on (a competência). Não mexe em anuladas.
  const { data: cps } = await supabase.from('client_payments').select('numero_semana, paid_on, anulado').eq('client_id', clientId)
  let redated = 0
  for (const p of cps ?? []) {
    if (p.anulado) continue
    const n = Number(p.numero_semana)
    const due = dueDateFor(start, dia, n)
    if (String(p.paid_on ?? '').slice(0, 10) === due) continue
    let uq = supabase.from('client_payments').update({ paid_on: due }).eq('client_id', clientId).eq('numero_semana', n)
    if (teamId) uq = uq.eq('team_id', teamId)
    const { error: e1 } = await uq
    if (e1) continue
    if (deal) {
      let wq = supabase.from('weekly_payments').update({ paid_on: due }).eq('deal_id', deal.id).eq('numero_semana', n)
      if (teamId) wq = wq.eq('team_id', teamId)
      await wq
    }
    redated++
  }

  // Backfill das semanas vencidas que faltam (paid_on = vencimento; receita + comissão derivada).
  const { marked } = await payDueWeeks(supabase, clientId, rate, Math.max(dueCount, 12), teamId)
  return { ok: true, redated, marked, dueCount, hadDeal }
}

// ─── Pagamento MENSAL (F2) ────────────────────────────────────────────────────────────────────
// ORQUESTRADOR sobre o motor SEMANAL — NÃO é um 2º motor. Quita todas as semanas cujo VENCIMENTO cai
// no mês `monthRef` (YYYY-MM), reusando payClientWeek para cada uma → receita (client_payments) +
// comissão derivada (weekly_payments), com competência (paid_on = vencimento), câmbio congelado e teto
// respeitados EXATAMENTE como no fluxo semanal. Diferente de payDueWeeks, NÃO trava em "hoje": pagar o
// mês quita o mês inteiro (o cliente pagou tudo). Idempotente: semana já registrada é pulada.
export async function payMonth(
  supabase: SupaClient, clientId: string, monthRef: string, rate: number, teamId?: string | null,
): Promise<{ marked: number[]; reason: string; monthRef: string }> {
  const { data: cli } = await supabase.from('clients').select('status, start_date, dia_pagamento_semana').eq('id', clientId).is('deleted_at', null).maybeSingle()
  if (!cli) return { marked: [], reason: 'nao_encontrado', monthRef }
  if (cli.status !== 'ativo') return { marked: [], reason: 'inativo', monthRef }
  if (!cli.start_date) return { marked: [], reason: 'sem_inicio', monthRef }
  const start = String(cli.start_date).slice(0, 10)
  const dia = cli.dia_pagamento_semana ?? dowOfYmd(start)

  const { data: cps } = await supabase.from('client_payments').select('numero_semana').eq('client_id', clientId)
  const registered = new Set((cps ?? []).map(r => r.numero_semana as number)) // inclui anuladas → não re-marca

  const marked: number[] = []
  for (let n = 1; n <= 520; n++) {
    const due = dueDateFor(start, dia, n)
    const m = due.slice(0, 7)
    if (m < monthRef) continue      // vencimento antes do mês pedido
    if (m > monthRef) break         // passou do mês (datas monotônicas → encerra)
    if (registered.has(n)) continue // semana já paga/anulada
    const res = await payClientWeek(supabase, clientId, n, due, rate, teamId) // MESMA escrita do semanal
    if (res.ok) marked.push(n)
    else if (res.reason !== 'dup') break
  }
  return { marked, reason: marked.length ? 'ok' : 'nada_no_mes', monthRef }
}

// ─── Upgrade de plano (F3) ────────────────────────────────────────────────────────────────────
// CONECTA o upgrade ao motor VIVO (não cria 2º motor). O bônus = SÓ a diferença (config
// upgrade_commission_* do vendedor, base=plan_difference), lançado UMA vez na competência do upgrade
// como um weekly_payment num "deal-delta" (status 'upgrade_bonus' ≠ 'em_andamento' → a derivação semanal
// o ignora; Minha Remuneração/PDF/relatórios somam por paid_on → aparece sozinho). Registra o evento em
// plan_changes (auditoria) e move o cliente para o novo plano (billing futuro). NÃO duplica: só o incremento.
const round2u = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export async function applyPlanUpgrade(
  supabase: SupaClient, args: { clientId: string; newPlanId: string; changedAt: string; rate: number; teamId?: string | null },
): Promise<{ ok: boolean; reason?: string; bonus: number; deltaMensal: number; sellerId: string | null }> {
  const { clientId, newPlanId, changedAt, rate, teamId } = args
  const base0 = { bonus: 0, deltaMensal: 0, sellerId: null as string | null }
  const { data: cli } = await supabase.from('clients').select('name, plano_id, plan_weekly, status, assigned_name').eq('id', clientId).is('deleted_at', null).maybeSingle()
  if (!cli) return { ok: false, reason: 'nao_encontrado', ...base0 }
  if (cli.status !== 'ativo') return { ok: false, reason: 'inativo', ...base0 }
  if (cli.plano_id === newPlanId) return { ok: false, reason: 'mesmo_plano', ...base0 }

  const ids = [cli.plano_id, newPlanId].filter(Boolean) as string[]
  const { data: plans } = await supabase.from('plans').select('id, nome, valor_semanal, valor_mensal').in('id', ids)
  const oldPlan = (plans ?? []).find(p => p.id === cli.plano_id) ?? null
  const newPlan = (plans ?? []).find(p => p.id === newPlanId)
  if (!newPlan) return { ok: false, reason: 'plano_invalido', ...base0 }
  const oldMensal = Number(oldPlan?.valor_mensal ?? (Number(cli.plan_weekly) || 0) * 4)
  const newMensal = Number(newPlan.valor_mensal ?? Number(newPlan.valor_semanal) * 4)
  const deltaMensal = round2u(newMensal - oldMensal)
  if (deltaMensal <= 0) return { ok: false, reason: 'nao_e_upgrade', bonus: 0, deltaMensal, sellerId: null }

  // Vendedor = dono do deal ativo do cliente (fallback: 1º vendedor ativo — mesma regra do won-flow).
  const { data: deals } = await supabase.from('deals').select('seller_id').eq('client_id', clientId).eq('status', 'em_andamento').order('data_fechamento', { ascending: false }).limit(1)
  let sellerId: string | null = deals?.[0]?.seller_id ?? null
  if (!sellerId) { const { data: s } = await supabase.from('sellers').select('id').eq('status', 'ativo').order('created_at').limit(1); sellerId = s?.[0]?.id ?? null }

  // Responsável sem comissão (Parte 3): Daniel & cia. NÃO recebem bônus de upgrade. O plano ainda muda (billing)
  // e o evento é auditado (plan_changes) — só o BÔNUS na comissão não é lançado. Resolve pelo RESPONSÁVEL do
  // cliente (não pelo vendedor de fallback), senão um cliente do Daniel sem deal cairia no 1º ativo e ganharia bônus.
  const { geraComissao } = await resolveSellerForCommission(supabase, (cli as { assigned_name?: string | null }).assigned_name ?? null, teamId)

  // Bônus a partir da config JÁ EXISTENTE do vendedor (nada de regra nova; só é lida e aplicada).
  let bonus = 0
  if (sellerId && geraComissao) {
    const { data: cfg } = await supabase.from('collaborator_compensation_settings')
      .select('upgrade_commission_enabled, upgrade_commission_type, upgrade_commission_value, upgrade_commission_base').eq('seller_id', sellerId).maybeSingle()
    if (cfg?.upgrade_commission_enabled) {
      const cfgBase = cfg.upgrade_commission_base === 'full_value' ? newMensal : deltaMensal // padrão: só a diferença
      const val = Number(cfg.upgrade_commission_value) || 0
      bonus = cfg.upgrade_commission_type === 'fixed' ? round2u(val) : round2u(cfgBase * val / 100)
    }
  }

  // Bônus na comissão (motor vivo) via deal-delta + weekly_payment — PRIMEIRO (se falhar, aborta limpo,
  // nada gravado). Status 'concluido' (permitido pelo deals_status_check) ≠ 'em_andamento' → a derivação
  // semanal e o "receber esta semana" IGNORAM este deal; Minha Remuneração/PDF/relatórios somam a semana
  // por paid_on. teto=1, 1 semana = o bônus exato. Só se houver bônus e vendedor.
  if (bonus > 0 && sellerId) {
    const { data: dd, error: ddErr } = await supabase.from('deals').insert({
      seller_id: sellerId, client_id: clientId, client_name: `${cli.name} (upgrade ${oldPlan?.nome ?? '—'}→${newPlan.nome})`,
      valor_total_usd: bonus, teto_semanas: 1, valor_por_semana_usd: bonus, comissao_percentual: null,
      status: 'concluido', data_fechamento: changedAt, ...withTeam(teamId),
    }).select('id').single()
    if (ddErr || !dd) return { ok: false, reason: 'bonus_deal', bonus, deltaMensal, sellerId }
    const { error: wErr } = await supabase.from('weekly_payments').insert({
      deal_id: dd.id, numero_semana: 1, valor_usd: bonus, paid_on: changedAt, cotacao_usd_brl: rate, ...withTeam(teamId),
    })
    if (wErr) { await supabase.from('deals').delete().eq('id', dd.id); return { ok: false, reason: 'bonus_week', bonus, deltaMensal, sellerId } }
  }

  // Evento auditável (grava depois do bônus estar garantido; grava mesmo com bônus 0 = config desligada).
  await supabase.from('plan_changes').insert({
    client_id: clientId, seller_id: sellerId, old_plan_id: cli.plano_id ?? null, new_plan_id: newPlanId,
    old_valor_semanal: oldPlan?.valor_semanal ?? cli.plan_weekly, new_valor_semanal: newPlan.valor_semanal,
    delta_mensal_usd: deltaMensal, bonus_usd: bonus, changed_at: changedAt, ...withTeam(teamId),
  })

  // Cliente passa a valer pelo novo plano (billing futuro = novo valor_semanal). Não altera semanas já pagas.
  await supabase.from('clients').update({ plano_id: newPlanId, plan_weekly: newPlan.valor_semanal }).eq('id', clientId)
  return { ok: true, bonus, deltaMensal, sellerId }
}

// Mês de competência da PRÓXIMA semana não paga (YYYY-MM) — usado pela UI p/ "pagar o próximo mês".
export async function nextUnpaidMonth(
  supabase: SupaClient, clientId: string,
): Promise<string | null> {
  const { data: cli } = await supabase.from('clients').select('start_date, dia_pagamento_semana').eq('id', clientId).is('deleted_at', null).maybeSingle()
  if (!cli?.start_date) return null
  const start = String(cli.start_date).slice(0, 10)
  const dia = cli.dia_pagamento_semana ?? dowOfYmd(start)
  const { data: cps } = await supabase.from('client_payments').select('numero_semana').eq('client_id', clientId)
  const registered = new Set((cps ?? []).map(r => r.numero_semana as number))
  let n = 1; while (registered.has(n)) n++
  return dueDateFor(start, dia, n).slice(0, 7)
}

// ─── Cadastro/edição com HISTÓRICO automático (CLIENT-HISTORY-ADMIN-003) ────────────────────────
// ORQUESTRADOR: dadas as datas históricas do pipeline, reconstrói TODA a jornada nas datas REAIS costurando
// os escritores que já existem (lead / stage_events / meeting / deal / interações) e, no fim, o motor
// financeiro (reconstructClientHistory → semanas + comissão + receita por paid_on). NÃO é motor novo: liga o
// que já existe. Roda no SAVE do cliente — sem botão "reconstruir". Idempotente onde dá: atualiza as datas de
// linhas existentes e só CRIA as que faltam; stage_events/1º-contato só entram se o lead ainda não os tem
// (não duplica em re-edições). Datas de pipeline vêm como YYYY-MM-DD; stage_events usam meio-dia UTC (sem
// deslocar o dia por fuso). O caller (server action) já gravou os campos do cliente (start_date/plano/dia/
// periodicidade/responsável) na tabela clients — aqui cuidamos das LINHAS de pipeline + reconstrução.
export interface ClientHistoryInput {
  startDate: string             // início do contrato (YYYY-MM-DD) — obrigatório p/ reconstruir
  leadDate?: string | null      // data do lead (leads.received_at)
  firstContact?: string | null  // primeiro contato (interação + last_contact_at)
  meetingDate?: string | null   // reunião (meetings.met_on + stage_event)
  proposalDate?: string | null  // proposta (stage_event)
  closeDate?: string | null     // fechamento (deals.data_fechamento + stage_event won); default = startDate
}

const ymdOnly = (s?: string | null): string | null => {
  if (!s) return null
  const v = String(s).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}
const atNoon = (ymd: string): string => `${ymd}T12:00:00.000Z` // timestamp estável (meio-dia UTC não vira o dia)

// Vendedor + se GERA COMISSÃO (PRODUCT-SPRINT-003, Parte 3). Resolve por nome (assigned_name → 1º ativo, mesma
// regra do won-flow) e devolve a flag gera_comissao. Um vendedor com gera_comissao=false (ex.: Daniel, o dono)
// NUNCA gera comissão: o chamador PULA a criação de deal/reunião/upgrade. A RECEITA (client_payments) continua.
// TEAM-SCOPE (FIX-CLIENTS-AUDIT-001): filtra por team_id quando informado. A RLS de sellers já é team_scope, mas
// os caminhos service-role (saveClientHistory/saveLeadHistory) IGNORAM a RLS — sem este filtro, o fallback
// "1º ativo" podia pegar vendedor de OUTRA equipe. Com teamId, nunca cruza equipe. NÃO muda a regra de comissão.
export async function resolveSellerForCommission(
  supabase: SupaClient, assignedName: string | null | undefined, teamId?: string | null,
): Promise<{ sellerId: string | null; geraComissao: boolean }> {
  const flagOf = (row: { id: string; gera_comissao?: boolean } | undefined) =>
    row ? { sellerId: row.id, geraComissao: row.gera_comissao !== false } : null
  const nm = (assignedName ?? '').trim()
  if (nm) {
    let q = supabase.from('sellers').select('id, gera_comissao').eq('status', 'ativo').ilike('name', `%${nm}%`)
    if (teamId) q = q.eq('team_id', teamId)
    const { data } = await q.limit(1)
    const hit = flagOf(data?.[0]); if (hit) return hit
  }
  let q2 = supabase.from('sellers').select('id, gera_comissao').eq('status', 'ativo')
  if (teamId) q2 = q2.eq('team_id', teamId)
  const { data } = await q2.order('created_at').limit(1)
  return flagOf(data?.[0]) ?? { sellerId: null, geraComissao: true }
}

// Um vendedor específico (por id) gera comissão? (default true se não achar/sem flag).
async function sellerGeraComissao(supabase: SupaClient, sellerId: string | null): Promise<boolean> {
  if (!sellerId) return true
  const { data } = await supabase.from('sellers').select('gera_comissao').eq('id', sellerId).maybeSingle()
  return (data as { gera_comissao?: boolean } | null)?.gera_comissao !== false
}

// Reconstrói os EVENTOS de pipeline de um lead (reunião, jornada de fases, 1º contato) nas DATAS reais.
// COMPARTILHADO por saveClientHistory (cliente) e saveLeadHistory (lead) — sem duplicar. Idempotente: só cria o
// que falta (meeting por lead/cliente; stage_events e 1º contato só se o lead ainda não tem nenhum). A etapa
// FINAL é opcional: cliente passa won@fechamento; lead ainda no funil pode parar na proposta (finalStage null).
async function reconstructLeadPipelineEvents(
  supabase: SupaClient,
  a: { leadId: string; leadName: string; sellerId: string | null; sellerName: string | null; clientId?: string | null;
    geraComissao: boolean;
    leadDate: string; firstContact: string | null; meetingDate: string | null; proposalDate: string | null;
    finalStage: string | null; finalDate: string | null },
  rate: number, teamId?: string | null,
): Promise<{ stageEvents: number; createdMeeting: boolean }> {
  const { leadId, leadName, sellerId, sellerName, clientId, geraComissao, leadDate, firstContact, meetingDate, proposalDate, finalStage, finalDate } = a

  // MEETING (met_on = data REAL): atualiza a existente (por lead/cliente) ou cria uma via registerMeeting.
  // CORTE (Parte 6): reunião com competência ≥ JUL/2026 não vira comissão → não cria a linha. RESPONSÁVEL SEM
  // COMISSÃO (Parte 3): Daniel & cia. também não geram reunião. A jornada de fases abaixo (stage_event 'reuniao')
  // registra a reunião no funil/timeline de qualquer forma.
  let createdMeeting = false
  if (meetingDate && sellerId && geraComissao && meetingCommissionCounts(meetingDate)) {
    let mid: string | null = null
    { const { data } = await supabase.from('meetings').select('id').eq('lead_id', leadId).limit(1); mid = data?.[0]?.id ?? null }
    if (!mid && clientId) { const { data } = await supabase.from('meetings').select('id').eq('client_id', clientId).limit(1); mid = data?.[0]?.id ?? null }
    if (mid) { let mq = supabase.from('meetings').update({ met_on: meetingDate }).eq('id', mid); if (teamId) mq = mq.eq('team_id', teamId); await mq }
    else { const { error } = await registerMeeting(supabase, sellerId, { metOn: meetingDate, valorUsd: 15, clientId: clientId ?? null, clientName: leadName, leadId }, rate, teamId); if (!error) createdMeeting = true; else console.warn('[reconstructLeadPipelineEvents] falha ao criar reunião histórica (best-effort):', error.message) }
  }

  // STAGE EVENTS históricos — reconstrói a jornada do funil (→reunião →proposta →final) nas datas reais, para
  // funil/relatórios/timeline baterem. SÓ se o lead ainda não tem nenhum (não duplica em re-edições).
  let stageEvents = 0
  const { data: existing } = await supabase.from('stage_events').select('id').eq('lead_id', leadId).limit(1)
  if (!existing || existing.length === 0) {
    const rows: Record<string, string | null>[] = []
    const ev = (from: string | null, to: string, ymd: string) => rows.push({ lead_id: leadId, lead_name: leadName, from_stage: from, to_stage: to, changed_at: atNoon(ymd), seller_id: sellerId, seller_name: sellerName, ...(teamId ? { team_id: teamId } : {}) })
    ev(null, 'novo', leadDate)
    let prev = 'novo'
    if (meetingDate) { ev(prev, 'reuniao', meetingDate); prev = 'reuniao' }
    if (proposalDate) { ev(prev, 'proposta', proposalDate); prev = 'proposta' }
    if (finalStage && finalDate && finalStage !== prev) ev(prev, finalStage, finalDate)
    if (rows.length > 0) { const { error } = await supabase.from('stage_events').insert(rows); if (!error) stageEvents = rows.length; else console.warn('[reconstructLeadPipelineEvents] falha ao gravar stage_events históricos (best-effort):', error.message) }
  }

  // PRIMEIRO CONTATO como interação (created_at histórico) — só se o lead ainda não tem interações. Aparece na
  // timeline como "Contato" na data real (a timeline lê created_at). service-role pode gravar created_at.
  if (firstContact) {
    const { data: existingInt } = await supabase.from('lead_interactions').select('id').eq('lead_id', leadId).limit(1)
    if (!existingInt || existingInt.length === 0) {
      const { error } = await supabase.from('lead_interactions').insert({
        lead_id: leadId, type: 'atendeu', note: 'Primeiro contato', score_delta: 0,
        created_by_name: sellerName, created_at: atNoon(firstContact), ...withTeam(teamId),
      })
      if (error) console.warn('[reconstructLeadPipelineEvents] falha ao gravar 1º contato histórico (best-effort):', error.message)
    }
  }
  return { stageEvents, createdMeeting }
}

export async function saveClientHistory(
  supabase: SupaClient, clientId: string, input: ClientHistoryInput, wonSlugStr: string, rate: number, teamId?: string | null,
): Promise<{ ok: boolean; reason?: string; leadId: string | null; createdLead: boolean; createdDeal: boolean; createdMeeting: boolean; stageEvents: number; redated: number; marked: number[]; hadDeal: boolean }> {
  const fail = (reason: string) => ({ ok: false, reason, leadId: null, createdLead: false, createdDeal: false, createdMeeting: false, stageEvents: 0, redated: 0, marked: [] as number[], hadDeal: false })
  const start = ymdOnly(input.startDate)
  if (!start) return fail('sem_inicio')
  // Raw = só o que o usuário informou (pode ser null); Eff = com fallback p/ CRIAR/computar linhas. Escrever em
  // linha EXISTENTE usa o raw (não clobbera received_at/data_fechamento bons quando o campo vem vazio na re-edição).
  const leadRaw = ymdOnly(input.leadDate)
  const closeRaw = ymdOnly(input.closeDate)
  const leadDate = leadRaw ?? start
  const close = closeRaw ?? start
  const meetingDate = ymdOnly(input.meetingDate)
  const firstContact = ymdOnly(input.firstContact)
  const proposalDate = ymdOnly(input.proposalDate)

  const { data: cli } = await supabase.from('clients').select('name, assigned_to, assigned_name, status, plano_id').eq('id', clientId).is('deleted_at', null).maybeSingle()
  if (!cli) return fail('nao_encontrado')
  if (cli.status !== 'ativo') return fail('inativo')
  const clientName = String(cli.name ?? '').trim()
  const sellerName = (cli.assigned_name as string | null) ?? null

  // Deal em_andamento do cliente (o MESMO que a derivação de comissão usa).
  const { data: deals } = await supabase.from('deals').select('id, lead_id, seller_id').eq('client_id', clientId).eq('status', 'em_andamento').order('data_fechamento', { ascending: false }).limit(1)
  let deal = deals?.[0] ?? null

  // Vendedor + GERA COMISSÃO? (Parte 3). Deal existente manda no vendedor; senão resolve pelo responsável.
  // Responsável sem comissão (Daniel) → geraComissao=false → NÃO cria deal (zero comissão); a RECEITA continua.
  let sellerId: string | null = (deal?.seller_id as string | null) ?? null
  let geraComissao: boolean
  if (sellerId) { geraComissao = await sellerGeraComissao(supabase, sellerId) }
  else { const r = await resolveSellerForCommission(supabase, sellerName, teamId); sellerId = r.sellerId; geraComissao = r.geraComissao }

  // LEAD: via deal.lead_id → por nome → cria (won, received_at histórico). NÃO marca origem='cliente_existente'
  // (esse valor é EXCLUÍDO das métricas de período): é um lead ganho real e deve contar no funil/relatórios.
  let leadId: string | null = (deal?.lead_id as string | null) ?? null
  let createdLead = false
  if (!leadId && clientName) { const { data } = await supabase.from('leads').select('id').ilike('name', clientName).limit(1); leadId = data?.[0]?.id ?? null }
  if (!leadId && clientName) {
    const { data: nl } = await supabase.from('leads').insert({
      name: clientName, status: wonSlugStr, received_at: leadDate, stage_changed_at: atNoon(close),
      last_contact_at: firstContact ? atNoon(firstContact) : atNoon(leadDate),
      assigned_to: cli.assigned_to ?? null, assigned_name: sellerName, ...withTeam(teamId),
    }).select('id').single()
    if (nl) { leadId = nl.id; createdLead = true }
  } else if (leadId) {
    // Não-destrutivo: só escreve os campos que o usuário informou (raw). status=won é seguro (é o lead do cliente).
    const leadPatch: Record<string, string> = { status: wonSlugStr }
    if (leadRaw) leadPatch.received_at = leadRaw
    if (closeRaw) leadPatch.stage_changed_at = atNoon(closeRaw)
    if (firstContact) leadPatch.last_contact_at = atNoon(firstContact)
    let lq = supabase.from('leads').update(leadPatch).eq('id', leadId)
    if (teamId) lq = lq.eq('team_id', teamId)
    await lq
  }

  // DEAL: cria se não existe (reusa a comissão por plano do won-flow), senão realinha data_fechamento + lead_id.
  // SÓ cria deal se o responsável gera comissão (Parte 3) — Daniel & cia. ficam sem deal → sem comissão semanal.
  let createdDeal = false
  if (!deal && sellerId && leadId && geraComissao) {
    let vps = LEGACY_VPS_USD; let pctUsed: number | null = null
    if (cli.plano_id) {
      const { data: pl } = await supabase.from('plans').select('valor_semanal, comissao_percentual').eq('id', cli.plano_id).maybeSingle()
      const pct = pl?.comissao_percentual != null ? Number(pl.comissao_percentual) : null
      if (pl && hasCommissionPct(pct)) { pctUsed = pct; vps = weeklyCommissionUsd(Number(pl.valor_semanal), pct) }
    }
    const teto = DEFAULT_TETO_SEMANAS
    const { data: nd } = await supabase.from('deals').insert({
      seller_id: sellerId, client_id: clientId, client_name: clientName, lead_id: leadId,
      valor_total_usd: Math.round(vps * teto * 100) / 100, teto_semanas: teto, valor_por_semana_usd: vps, comissao_percentual: pctUsed,
      status: 'em_andamento', data_fechamento: close, ...withTeam(teamId),
    }).select('id, lead_id, seller_id').single()
    if (nd) { deal = nd; createdDeal = true }
  } else if (deal) {
    // Não-destrutivo: só realinha data_fechamento se o fechamento foi informado; sempre garante o vínculo do lead.
    const dealPatch: Record<string, string> = {}
    if (closeRaw) dealPatch.data_fechamento = closeRaw
    if (leadId) dealPatch.lead_id = leadId
    if (Object.keys(dealPatch).length > 0) {
      let dq = supabase.from('deals').update(dealPatch).eq('id', deal.id)
      if (teamId) dq = dq.eq('team_id', teamId)
      await dq
    }
  }

  // Eventos de pipeline (reunião + jornada de fases + 1º contato) nas datas reais — HELPER compartilhado com leads.
  let createdMeeting = false, stageEvents = 0
  if (leadId) {
    const ev = await reconstructLeadPipelineEvents(supabase, {
      leadId, leadName: clientName, sellerId, sellerName, clientId, geraComissao,
      leadDate, firstContact, meetingDate, proposalDate, finalStage: wonSlugStr, finalDate: close,
    }, rate, teamId)
    createdMeeting = ev.createdMeeting; stageEvents = ev.stageEvents
  }

  // MOTOR FINANCEIRO: semanas + comissão + receita nas datas reais (paid_on por vencimento). Reuso puro.
  const r = await reconstructClientHistory(supabase, clientId, rate, teamId)
  return { ok: r.ok, reason: r.reason, leadId, createdLead, createdDeal, createdMeeting, stageEvents, redated: r.redated, marked: r.marked, hadDeal: r.hadDeal || createdDeal }
}

// ─── LEAD histórico (CLIENT-HISTORY-ADMIN-003, Parte 4) ─────────────────────────────────────────
// MESMA ideia do cliente, para um LEAD (ainda no funil ou vendido). Grava received_at/1º contato/venda no lead
// e reconstrói a jornada (reunião/proposta/[fechamento]) nas datas reais pelo HELPER compartilhado — sem motor
// novo, sem duplicar. Se `saleDate` vier, o lead vira won (status + fechamento); senão para na proposta. Não há
// deal/semanas aqui (isso é do CLIENTE): quando o lead vira cliente, o saveClientHistory cuida do financeiro.
export interface LeadHistoryInput {
  leadDate?: string | null      // data do lead (received_at)
  firstContact?: string | null  // primeiro contato
  meetingDate?: string | null   // reunião
  proposalDate?: string | null  // proposta
  saleDate?: string | null      // venda (se informado → lead vira won: status + stage_changed_at)
}

export async function saveLeadHistory(
  supabase: SupaClient, leadId: string, input: LeadHistoryInput, wonSlugStr: string, rate: number, teamId?: string | null,
): Promise<{ ok: boolean; reason?: string; stageEvents: number; createdMeeting: boolean }> {
  const leadRaw = ymdOnly(input.leadDate)
  const saleRaw = ymdOnly(input.saleDate)
  const meetingDate = ymdOnly(input.meetingDate)
  const firstContact = ymdOnly(input.firstContact)
  const proposalDate = ymdOnly(input.proposalDate)

  const { data: lead } = await supabase.from('leads').select('name, assigned_name, received_at').eq('id', leadId).maybeSingle()
  if (!lead) return { ok: false, reason: 'nao_encontrado', stageEvents: 0, createdMeeting: false }
  const leadName = String(lead.name ?? '').trim()
  const sellerName = (lead.assigned_name as string | null) ?? null

  // Vendedor + gera comissão? (Parte 3). Responsável sem comissão (Daniel) → reunião não vira comissão.
  const { sellerId, geraComissao } = await resolveSellerForCommission(supabase, sellerName, teamId)

  // Update NÃO-destrutivo do lead: só o que foi informado. Se vendido, status=won + fechamento.
  const leadPatch: Record<string, string> = {}
  if (leadRaw) leadPatch.received_at = leadRaw
  if (firstContact) leadPatch.last_contact_at = atNoon(firstContact)
  if (saleRaw) { leadPatch.status = wonSlugStr; leadPatch.stage_changed_at = atNoon(saleRaw) }
  if (Object.keys(leadPatch).length > 0) { let lq = supabase.from('leads').update(leadPatch).eq('id', leadId); if (teamId) lq = lq.eq('team_id', teamId); await lq }

  // Data-âncora da jornada: a informada, senão o received_at atual do lead. Sem âncora válida → só fez o update.
  const leadDateEff = leadRaw ?? ymdOnly(lead.received_at)
  if (!leadDateEff) return { ok: true, stageEvents: 0, createdMeeting: false }

  const ev = await reconstructLeadPipelineEvents(supabase, {
    leadId, leadName, sellerId, sellerName, clientId: null, geraComissao,
    leadDate: leadDateEff, firstContact, meetingDate, proposalDate,
    finalStage: saleRaw ? wonSlugStr : null, finalDate: saleRaw,
  }, rate, teamId)
  return { ok: true, stageEvents: ev.stageEvents, createdMeeting: ev.createdMeeting }
}
