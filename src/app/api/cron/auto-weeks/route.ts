import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { payDueWeeks, dueDateFor, resolveClientPlan } from '@/lib/commission/actions'

// Robô diário: marca as semanas de RECEITA VENCIDAS de cada cliente ativo, reusando payDueWeeks
// (receita em client_payments + comissão derivada via payWeek — teto 4, sem duplicar, sem recriar
// anulada). Roda sem sessão → service-role. Protegida por CRON_SECRET (padrão do Vercel Cron).
// ?dryRun=1 retorna o que ELA INSERIRIA hoje, SEM gravar nada (auditoria).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const spToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // YYYY-MM-DD (Brasília)

export async function GET(req: Request) {
  // Auth: Vercel Cron envia Authorization: Bearer ${CRON_SECRET}. Sem secret válido → 401.
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'
  const supabase = createServiceClient()
  const today = spToday()

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
    .select('id, name, assigned_name, status, start_date, end_date, dia_pagamento_semana')
    .eq('status', 'ativo').is('deleted_at', null)   // SOFT-DELETE: nunca cobra cliente excluído (service-role ignora RLS)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const eligible = (clients ?? []).filter(c =>
    c.dia_pagamento_semana != null && c.start_date &&
    (!c.end_date || String(c.end_date).slice(0, 10) >= today),
  )

  if (dryRun) {
    const items: { client: string; numero_semana: number; paid_on: string; valor_usd: number; geraria_comissao: boolean }[] = []
    for (const c of eligible) {
      const start = String(c.start_date).slice(0, 10)
      const dia = Number(c.dia_pagamento_semana)
      const { valorUsd } = await resolveClientPlan(supabase as Parameters<typeof resolveClientPlan>[0], c.id)
      const { data: cps } = await supabase.from('client_payments').select('numero_semana').eq('client_id', c.id)
      const reg = new Set((cps ?? []).map(r => r.numero_semana as number))   // inclui anuladas → não re-marca
      const { data: deals } = await supabase.from('deals').select('teto_semanas').eq('client_id', c.id).eq('status', 'em_andamento').limit(1)
      const hasDeal = !!deals?.[0]
      const teto = deals?.[0]?.teto_semanas ?? 0
      // Espelha a seleção do payDueWeeks (read-only): 1ª semana não registrada, due<=hoje, máx 12.
      for (let i = 0; i < 12; i++) {
        let n = 1; while (reg.has(n)) n++
        const due = dueDateFor(start, dia, n)
        if (due > today) break
        reg.add(n)
        items.push({ client: c.name as string, numero_semana: n, paid_on: due, valor_usd: valorUsd, geraria_comissao: hasDeal && n <= teto })
      }
    }
    return NextResponse.json({ ok: true, dryRun: true, today, rate, eligibleClients: eligible.length, count: items.length, items })
  }

  // Execução real (idempotente) — payDueWeeks faz a conta de receita + comissão.
  const results: { client: string; marked: number[]; reason: string }[] = []
  for (const c of eligible) {
    const { marked, reason } = await payDueWeeks(supabase as Parameters<typeof payDueWeeks>[0], c.id, rate)
    if (marked.length) results.push({ client: c.name as string, marked, reason })
  }
  const totalMarked = results.reduce((s, r) => s + r.marked.length, 0)
  return NextResponse.json({ ok: true, dryRun: false, today, rate, eligibleClients: eligible.length, totalMarked, results })
}
