import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { getRequestContext } from '@/server/context/request-context'
import { assertClientOwnership } from '@/server/security/team-ownership'
import { createServiceClient } from '@/lib/supabase/service'
import { payDueWeeks } from '@/lib/commission/actions'
import { resolveRate } from '@/lib/commission/calc'
import type { FxConfig } from '@/lib/commission/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// Auto-preenchimento DATE-GATED: payDueWeeks marca só as semanas cuja data real venceu (paid_on =
// data da semana), via payClientWeek (receita + comissão derivada). NUNCA marca futura. NÃO muda
// calc.ts/payWeek (US$25/teto/etc.) — só decide QUANDO/QUAL semana e a DATA.

// Comparação em tempo constante (sha256 → buffers de mesmo tamanho; não vaza comprimento).
function secretsMatch(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

function authorizedByToken(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  return !!secret && !!provided && secretsMatch(provided, secret)
}

type SupaService = ReturnType<typeof createServiceClient>

async function resolveServerRate(supabase: SupaService): Promise<number> {
  const { data: fx } = await supabase.from('fx_config').select('cotacao_manual, cotacao_travada, cotacao_referencia').eq('id', 1).maybeSingle()
  const manual = fx?.cotacao_manual != null ? Number(fx.cotacao_manual) : null
  const fxc: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fx?.cotacao_travada }
  const auto = Number(fx?.cotacao_referencia) || manual || 5.40
  const r = resolveRate(fxc, auto)
  return r > 0 ? r : 5.40
}

export async function POST(req: Request) {
  let body: { clientId?: string } = {}
  try { body = await req.json() } catch { /* sem corpo = cron */ }

  // Auth: token do agendador (cron, sem sessão) OU usuário logado (gatilho manual da tela).
  const byToken = authorizedByToken(req)
  const context = byToken ? null : await getRequestContext()
  if (!byToken && !context) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const rate = await resolveServerRate(supabase)

  // Gatilho MANUAL (1 cliente) — marca SÓ o que venceu até hoje (date-gated, nunca futura).
  // SEGURANÇA (P1-SERVICEROLE-001): numa sessão de usuário, confirma que o cliente é da EQUIPE ATIVA ANTES
  // de gerar receita/comissão (service-role ignora a RLS). Via token, o chamador é o sistema (sem equipe).
  if (body.clientId) {
    if (context) {
      const owned = await assertClientOwnership(supabase, body.clientId, context.activeTeamId)
      if (!owned.ok) return NextResponse.json({ ok: false, reason: owned.status === 403 ? 'forbidden' : 'no_client' }, { status: owned.status })
    }
    const r = await payDueWeeks(supabase, body.clientId, rate)
    return NextResponse.json({ ok: true, mode: 'single', marked: r.marked, reason: r.reason })
  }

  // CRON (todos) — SÓ pelo token do agendador: processa TODAS as equipes, não é ação de um usuário.
  if (!byToken) return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })
  // Só roda se ligado explicitamente. Date-gating cobre qualquer dia que o cron rode.
  if (process.env.COMMISSION_AUTO_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, mode: 'all', disabled: true, note: 'COMMISSION_AUTO_ENABLED != "true"' })
  }
  const { data: clients } = await supabase.from('clients').select('id').eq('status', 'ativo').is('deleted_at', null)
  const marked: Record<string, number[]> = {}
  for (const c of clients ?? []) {
    const r = await payDueWeeks(supabase, c.id as string, rate)
    if (r.marked.length) marked[c.id as string] = r.marked
  }
  return NextResponse.json({ ok: true, mode: 'all', count: (clients ?? []).length, marked })
}
