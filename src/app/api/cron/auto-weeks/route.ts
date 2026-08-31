import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { scheduleDueWeeks, dueDateFor, resolveClientPlanTimeline } from '@/lib/commission/actions'
import { todaySP, formatDateBR } from '@/lib/date'
import { loadTeamRates } from '@/lib/commission/fx'
import { createHash, timingSafeEqual } from 'crypto'

// Robô diário: agenda semanas vencidas. Nunca confirma recebimento e nunca gera comissão sozinho.
// ?dryRun=1 retorna o que ELA INSERIRIA hoje, SEM gravar nada (auditoria).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function secretsMatch(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

export async function GET(req: Request) {
  // Auth: Vercel Cron envia Authorization: Bearer ${CRON_SECRET}. Sem secret válido → 401.
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || !provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
  const supabase = createServiceClient()
  const today = todaySP()

  // Cotação efetiva — FONTE ÚNICA em lib/commission/fx. Este job é GLOBAL (varre todas as equipes), então
  // resolve a cotação POR EQUIPE: antes lia só a linha id=1 e carimbava a cotação dela na receita/comissão de
  // qualquer equipe. Só snapshot p/ BRL (não muda o USD).
  const { byTeam, fallback, error: fxError } = await loadTeamRates(supabase as Parameters<typeof loadTeamRates>[0])
  const rateFor = (team: string | null | undefined): number | null => (team ? byTeam.get(team) : null) ?? fallback

  // GUARD A4: se a leitura de fx_config FALHOU ou não há cotação real no banco, ABORTA sem gravar nada —
  // nunca congelar BRL com câmbio chutado. É SEGURO: payDueWeeks faz catch-up no próximo ciclo com a
    // cotação certa, então nenhuma semana se perde (só atrasa um ciclo). O USD não é afetado por isto.
  if (fxError || fallback == null) {
    const reason = fxError
      ? `erro lendo fx_config: ${fxError}`
      : 'sem cotação válida em fx_config (cotacao_manual/cotacao_referencia ausentes)'
    console.error('[cron/auto-weeks] ABORTADO sem gravar —', reason)
    return NextResponse.json({ ok: false, aborted: true, reason, today }, { status: 503 })
  }
  const rate = fallback   // usado só no relatório da resposta; a escrita usa rateFor(equipe)

  // Clientes ATIVOS com dia de pagamento definido. dia null → pular; end_date passou → pular.
  const { data: clients, error } = await supabase.from('clients')
    .select('id, name, assigned_name, status, start_date, billing_anchor_date, end_date, dia_pagamento_semana, team_id')
    .eq('status', 'ativo').is('deleted_at', null)   // SOFT-DELETE: nunca cobra cliente excluído (service-role ignora RLS)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const eligible = (clients ?? []).filter(c =>
    c.dia_pagamento_semana != null && c.start_date &&
    (!c.end_date || String(c.end_date).slice(0, 10) >= today),
  )

  if (dryRun) {
    const items: { client: string; numero_semana: number; due_on: string; valor_previsto_usd: number; status: 'vencida' }[] = []
    for (const c of eligible) {
    const start = String(c.billing_anchor_date ?? c.start_date).slice(0, 10)
      const dia = Number(c.dia_pagamento_semana)
      const planAtWeek = await resolveClientPlanTimeline(supabase as Parameters<typeof resolveClientPlanTimeline>[0], c.id)
      const { data: cps } = await supabase.from('client_payments').select('numero_semana').eq('client_id', c.id)
      const reg = new Set((cps ?? []).map(r => r.numero_semana as number))   // inclui anuladas → não re-marca
      // Espelha a seleção do agendador (read-only): 1ª semana não registrada, due<=hoje, máx 12.
      for (let i = 0; i < 12; i++) {
        let n = 1; while (reg.has(n)) n++
        const due = dueDateFor(start, dia, n)
        if (due > today) break
        reg.add(n)
        const { valorUsd } = planAtWeek(n)
        items.push({ client: c.name as string, numero_semana: n, due_on: due, valor_previsto_usd: valorUsd, status: 'vencida' })
      }
    }
    return NextResponse.json({ ok: true, dryRun: true, today, rate, eligibleClients: eligible.length, count: items.length, items })
  }

  // Execução real (idempotente) — cria a pendência; pagamento exige confirmação humana.
  const results: { client: string; marked: number[]; reason: string }[] = []
  for (const c of eligible) {
    // BUGFIX team_id: sem sessão (cron/service-role) o trigger set_team_id_default não resolve a equipe no
    // multi-tenant → pagamento/comissão nasciam órfãos (team_id null) e sumiam da receita. Carimba explícito.
    const teamRate = rateFor(c.team_id)
    if (teamRate == null) continue   // equipe sem cotação: não inventa câmbio, tenta no próximo ciclo
    const { scheduled, reason } = await scheduleDueWeeks(supabase as Parameters<typeof scheduleDueWeeks>[0], c.id, teamRate, 12, c.team_id)
    if (scheduled.length) results.push({ client: c.name as string, marked: scheduled, reason })
  }
  const totalMarked = results.reduce((s, r) => s + r.marked.length, 0)
  const { data: renewals, error: renewalError } = await supabase.rpc('process_due_renewals', { p_as_of: today })
  if (renewalError) console.error('[cron/auto-weeks] renovacoes:', renewalError.message)

  // ── AVISO DE CONFIRMAÇÃO PENDENTE (P0-ALERTA-001) ───────────────────────────────────────────────
  // O robô AGENDA (status 'vencida'); receita e comissão só nascem quando um humano confirma o recebimento
  // (save_client_week). Sem nenhum aviso, esse passo parou por 3 semanas e ninguém percebeu — 55 semanas e
  // US$ 8,3k de receita travados. O antigo agent.verificarPagamentosAtrasados() virou no-op (lia a tabela
  // morta `payments`) e o /api/agent/scheduler nem tem entrada de cron, então o aviso nasce AQUI: no job que
  // já roda todo dia e já tem os dados na mão. Zero cron novo (não esbarra no limite do plano), zero IA.
  const backlog = await postPendingConfirmationAlert(supabase, clients ?? [], today)

  return NextResponse.json({ ok: true, dryRun: false, today, rate, eligibleClients: eligible.length, totalMarked, results, renewals: Number(renewals ?? 0), renewalError: renewalError?.message ?? null, backlog })
}

type ClientRow = { id: string; name: string | null; team_id: string | null }

// Tipo aceito pelo CHECK de activities + prefixo estável para deduplicar o aviso sem depender do texto todo.
const ALERT_TYPE = 'payment'
const ALERT_PREFIX = 'Confirmação pendente'

// Agrega as semanas VENCIDAS e não confirmadas por equipe e posta UM aviso no Hall. Idempotente na prática:
// se já houve aviso nas últimas 20h para a equipe, não repete (rerun manual do cron não vira spam).
//
// type='payment': `activities` tem CHECK que só aceita lead/client/payment/task/campaign/system. A primeira
// versão usava 'cobranca', que violava a constraint — o insert falhava, o erro morria num console.error e o
// aviso nunca apareceu (9 dias em silêncio). 'payment' já existe nos mapas de ícone/cor do Hall.
// A deduplicação olha o PREFIXO da descrição, não só o tipo: 'payment' é genérico e pode ser usado por outra
// coisa depois, e aí um aviso alheio calaria este.
//
// NÃO usa o postarNoHall do SuperAgent de propósito — aquele grava numa coluna `metadata` que não existe em
// `activities`, então falha silencioso. Aqui o team_id é carimbado explícito: service-role não tem sessão e o
// trigger set_team_id_default não resolveria a equipe (mesmo motivo do carimbo em scheduleDueWeeks).
async function postPendingConfirmationAlert(
  supabase: ReturnType<typeof createServiceClient>, clients: ClientRow[], today: string,
): Promise<{ team: string; semanas: number; usd: number; desde: string; erro?: string }[]> {
  const teamOf = new Map(clients.map(c => [c.id, c.team_id]))
  if (!teamOf.size) return []

  const { data: pend, error } = await supabase.from('client_payments')
    .select('client_id, due_on, valor_previsto_usd, valor_usd')
    .eq('status', 'vencida').lte('due_on', today)
  if (error) { console.error('[cron/auto-weeks] backlog:', error.message); return [] }

  const byTeam = new Map<string, { semanas: number; usd: number; desde: string }>()
  for (const p of pend ?? []) {
    const team = teamOf.get(p.client_id as string)   // cliente inativo/excluído não entra na lista
    if (!team) continue
    const cur = byTeam.get(team) ?? { semanas: 0, usd: 0, desde: '9999-12-31' }
    cur.semanas += 1
    cur.usd += Number(p.valor_previsto_usd ?? p.valor_usd ?? 0)
    const due = String(p.due_on ?? '').slice(0, 10)
    if (due && due < cur.desde) cur.desde = due
    byTeam.set(team, cur)
  }

  const posted: { team: string; semanas: number; usd: number; desde: string; erro?: string }[] = []
  const since = new Date(Date.now() - 20 * 3_600_000).toISOString()
  for (const [team, agg] of byTeam) {
    const { count } = await supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('team_id', team).eq('type', ALERT_TYPE).like('description', `${ALERT_PREFIX}%`)
      .is('deleted_at', null).gte('created_at', since)
    if (count) continue
    const valor = agg.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    const resumo = { team, semanas: agg.semanas, usd: Math.round(agg.usd * 100) / 100, desde: agg.desde }
    const { error: alertError } = await supabase.from('activities').insert({
      type: ALERT_TYPE,
      description: `${ALERT_PREFIX} · ${agg.semanas} semana(s) aguardando confirmação de recebimento — ${valor} em receita e a comissão vinculada seguem bloqueados. A mais antiga venceu em ${formatDateBR(agg.desde)}. Confirme em Clientes → Financeiro semanal.`,
      user_name: 'Sistema',
      team_id: team,
    })
    if (alertError) {
      // Falha do aviso vai para a RESPOSTA, não só para o console: foi exatamente assim que a versão
      // anterior ficou 9 dias quebrada sem ninguém perceber.
      console.error('[cron/auto-weeks] alerta:', alertError.message)
      posted.push({ ...resumo, erro: alertError.message })
    } else posted.push(resumo)
  }
  return posted
}
