import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSiteURL } from '@/lib/site-url'

// Callback de auth (PKCE, @supabase/ssr) — confirmação de e-mail E recuperação de senha:
// troca o `code` por sessão (grava os cookies) e volta pro app. NÃO decide onboarding aqui — a guarda
// do layout do dashboard faz isso. Suporta `next` (destino interno); erro/sem code → /login?error=auth.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  // Anti open-redirect: só caminhos internos ("/..."), nunca "//" nem URL absoluta.
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/hall'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Nunca usa Host/X-Forwarded-Host não confiável para construir redirecionamentos.
      return NextResponse.redirect(new URL(next, getSiteURL()))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', getSiteURL()))
}
