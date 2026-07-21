import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { scheduleDueWeeks, dueDateFor, resolveClientPlanTimeline } from '@/lib/commission/actions'
import { todaySP } from '@/lib/date'
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

  // Cotação efetiva = MESMA regra do /api/fx (sem forçar fetch): travada+manual → manual; senão a
  // referência automática armazenada → manual. Só snapshot p/ BRL (não muda o USD).
  const { data: fx, error: fxError } = await supabase.from('fx_config').select('cotacao_manual, cotacao_travada, cotacao_referencia').eq('id', 1).maybeSingle()
  const manual = fx?.cotacao_manual != null ? Number(fx.cotacao_manual) : null
  const referencia = fx?.cotacao_referencia != null ? Number(fx.cotacao_referencia) : null
  // SEM o fallback hardcoded 5.40: o rate só vale se vier do banco.
  const rate = (fx?.cotacao_travada && manual != null) ? manual : (referencia ?? manual ?? null)

  // GUARD A4: se a leitura de fx_config FALHOU ou não há cotação real no banco, ABORTA sem gravar nada —
  // nunca congelar BRL com câmbio chutado. É SEGURO: payDueWeeks faz catch-up no próximo ciclo com a
    // cotação certa, então nenhuma semana se perde (só atrasa um ciclo). O USD não é afetado por isto.
  if (fxError || rate == null || !(rate > 0)) {
    const reason = fxError
      ? `erro lendo fx_config: ${fxError.message}`
      : 'sem cotação válida em fx_config (cotacao_manual/cotacao_referencia ausentes)'
    console.error('[cron/auto-weeks] ABORTADO sem gravar —', reason)
    return NextResponse.json({ ok: false, aborted: true, reason, today }, { status: 503 })
  }

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
    const { scheduled, reason } = await scheduleDueWeeks(supabase as Parameters<typeof scheduleDueWeeks>[0], c.id, rate, 12, c.team_id)
    if (scheduled.length) results.push({ client: c.name as string, marked: scheduled, reason })
  }
  const totalMarked = results.reduce((s, r) => s + r.marked.length, 0)
  const { data: renewals, error: renewalError } = await supabase.rpc('process_due_renewals', { p_as_of: today })
  if (renewalError) console.error('[cron/auto-weeks] renovacoes:', renewalError.message)
  return NextResponse.json({ ok: true, dryRun: false, today, rate, eligibleClients: eligible.length, totalMarked, results, renewals: Number(renewals ?? 0), renewalError: renewalError?.message ?? null })
}
