import type { createClient } from '@/lib/supabase/client'

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

// Atualiza campos de um cliente. MESMA escrita da UI de Clientes (retorna o builder).
// NUNCA deleta — não há função de exclusão aqui de propósito.
export function updateClient(
  supabase: SupaClient, id: string,
  patch: Record<string, string | number | null>,
) {
  return supabase.from('clients').update(patch).eq('id', id)
}

// ─── Comissão nova (incremento 2): pagamento parte do CLIENTE → receita + comissão derivada ───

// Valor semanal do cliente (snapshot): plano (plans.valor_semanal) → plan_weekly → 140 (padrão).
export async function resolveClientPlan(
  supabase: SupaClient, clientId: string,
): Promise<{ planoId: string | null; valorUsd: number }> {
  const { data: cli } = await supabase.from('clients').select('plano_id, plan_weekly').eq('id', clientId).maybeSingle()
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
  const { data: cli } = await supabase.from('clients').select('status, start_date, dia_pagamento_semana').eq('id', clientId).maybeSingle()
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
  const { data: existing } = await supabase.from('clients').select('id, status').ilike('name', nm).limit(1)
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
  const { data: cli } = await supabase.from('clients').select('status, start_date, dia_pagamento_semana').eq('id', clientId).maybeSingle()
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
