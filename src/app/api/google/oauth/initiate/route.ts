import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { googleOAuthConfigured, signState, buildConsentUrl } from '@/lib/google/oauth'

// Inicia o consentimento OAuth do Google. Exige sessão (senão 401). Sem env de OAuth → volta pra Configurações
// com aviso (não quebra). State assinado carrega o user_id (CSRF). googleapis/oauth = Node (não Edge).
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const origin = new URL(req.url).origin
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL('/configuracoes?google=unconfigured', origin))
  }
  const state = signState(auth.user.id)
  return NextResponse.redirect(buildConsentUrl(state))
}
