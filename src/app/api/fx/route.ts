import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const FX_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL'
const FX_FALLBACK = 5.40 // último caso (regra 5): a cotação efetiva NUNCA pode ser 0/nula
const TIMEOUT_MS = 3000

// Dia YYYY-MM-DD no fuso de Brasília — define "cotação de hoje".
const spDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

// Busca USD->BRL na AwesomeAPI (campo bid). Timeout curto; null em QUALQUER falha.
async function fetchUsdBrl(): Promise<number | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(FX_URL, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    const bid = Number(json?.USDBRL?.bid)
    return Number.isFinite(bid) && bid > 0 ? bid : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

// Cotação efetiva do dia (fetch-on-read com cache diário + fallback). NÃO altera
// cotacao_manual/cotacao_travada nem qualquer cotacao_usd_brl histórico — só gerencia
// a cotacao_referencia (automática). Escreve pela MESMA sessão autenticada do app.
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const rl = checkRateLimit(`fx:${auth.user.id}`)
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429 })

  const force = await req.json().then(b => !!b?.force).catch(() => false)

  const { data: cfg } = await auth.supabase
    .from('fx_config')
    .select('cotacao_manual, cotacao_travada, cotacao_referencia, updated_at')
    .eq('id', 1)
    .maybeSingle()

  const manual = cfg?.cotacao_manual != null ? Number(cfg.cotacao_manual) : null
  const travada = !!cfg?.cotacao_travada
  let referencia = cfg?.cotacao_referencia != null ? Number(cfg.cotacao_referencia) : null
  const updatedAt = cfg?.updated_at as string | undefined

  // 2) Travada com manual definido: NUNCA busca; a efetiva é a manual.
  if (travada && manual != null) {
    return NextResponse.json({ referencia: referencia ?? manual, effective: manual, source: 'manual', travada: true })
  }

  // 3) Referência "fresca" = updated_at de hoje (Brasília) e referencia não-nula.
  const freshToday = !!updatedAt && referencia != null && spDay(new Date(updatedAt)) === spDay(new Date())
  let source: 'auto' | 'fallback' = 'auto'

  // 4) Não-fresca (ou forçada): busca na AwesomeAPI e grava a referência.
  if (force || !freshToday) {
    const fetched = await fetchUsdBrl()
    if (fetched != null) {
      referencia = fetched
      await auth.supabase.from('fx_config')
        .update({ cotacao_referencia: fetched, updated_at: new Date().toISOString() })
        .eq('id', 1)
      source = 'auto'
    } else {
      // 5) Fallback: última referência conhecida → manual → default. Nunca 0.
      source = 'fallback'
      referencia = referencia ?? manual ?? FX_FALLBACK
    }
  }

  const ref = referencia ?? manual ?? FX_FALLBACK
  const effective = travada && manual != null ? manual : ref
  return NextResponse.json({ referencia: ref, effective, source, travada })
}
