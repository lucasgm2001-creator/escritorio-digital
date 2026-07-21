import { NextResponse } from 'next/server'
import { createClient as createEphemeralClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/supabase/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'

// Limite AGRESSIVO e específico desta rota: verificação de senha é alvo
// clássico de brute-force. 5 tentativas a cada 15 minutos por usuário.
const VERIFY_LIMIT = 5
const VERIFY_WINDOW_MS = 15 * 60 * 1000

export async function POST(req: Request) {
  const authResult = await requireAuth(req)
  if ('error' in authResult) {
    return authResult.error
  }

  // Bucket próprio (prefixo) para não competir com a cota das rotas de IA.
  const rate = await checkRateLimit(`verify-password:${authResult.user.id}`, {
    limit: VERIFY_LIMIT,
    windowMs: VERIFY_WINDOW_MS,
  })
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente mais tarde.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rate.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(VERIFY_LIMIT),
          'X-RateLimit-Remaining': String(rate.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rate.resetTime / 1000)),
        },
      }
    )
  }

  try {
    const { password } = await req.json()

    if (!password || typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({ error: 'Senha inválida.' }, { status: 400 })
    }

    const email = authResult.user.email
    if (!email) {
      return NextResponse.json({ valid: false }, { status: 200 })
    }

    // IMPORTANTE: verificar a senha NÃO pode alterar a sessão ativa.
    // O client SSR (@/lib/supabase/server) escreve cookies de sessão; chamar
    // signInWithPassword nele criaria uma sessão paralela e embaralharia os
    // cookies do usuário. Aqui usamos um client efêmero, em memória, com
    // persistSession desligado: ele valida a credencial e é descartado, sem
    // jamais tocar nos cookies da requisição.
    const ephemeral = createEphemeralClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data, error } = await ephemeral.auth.signInWithPassword({ email, password })

    // Resposta genérica: não distinguimos "senha errada" de "erro" para não
    // vazar informação sobre a conta.
    if (error || !data.user) {
      return NextResponse.json({ valid: false }, { status: 200 })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('[verify-password] Error:', error)
    return NextResponse.json({ valid: false }, { status: 200 })
  }
}
