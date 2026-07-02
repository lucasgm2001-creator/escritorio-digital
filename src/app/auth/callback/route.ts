import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Callback de confirmação de e-mail (PKCE, @supabase/ssr): troca o `code` por uma sessão (grava os
// cookies) e volta pro app. NÃO decide onboarding aqui — a guarda do layout do dashboard faz isso
// (sem equipe → /onboarding; com equipe → dashboard). Erro → /login.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Atrás de proxy (Vercel prod/preview): respeita o host encaminhado p/ não voltar ao host interno.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocal = process.env.NODE_ENV === 'development'
      const base = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`
      return NextResponse.redirect(`${base}/hall`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
