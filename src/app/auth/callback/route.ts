import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Callback de auth (PKCE, @supabase/ssr) — confirmação de e-mail E recuperação de senha:
// troca o `code` por sessão (grava os cookies) e volta pro app. NÃO decide onboarding aqui — a guarda
// do layout do dashboard faz isso. Suporta `next` (destino interno); erro/sem code → /login?error=auth.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  // Anti open-redirect: só caminhos internos ("/..."), nunca "//" nem URL absoluta.
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/hall'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Atrás de proxy (Vercel prod/preview): respeita o host encaminhado p/ não voltar ao host interno.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocal = process.env.NODE_ENV === 'development'
      const base = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`
      return NextResponse.redirect(`${base}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
