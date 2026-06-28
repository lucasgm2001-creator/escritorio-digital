import { NextResponse } from 'next/server'
import { verifyState, exchangeCodeForTokens, fetchGoogleEmail, saveTokensForUser } from '@/lib/google/oauth'

// Retorno do consentimento Google. VALIDA o state assinado (CSRF) → user_id; troca code por tokens; descobre
// o email (userinfo); UPSERT preservando o refresh_token salvo. Sempre volta pra /configuracoes. Node runtime.
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const to = (q: string) => NextResponse.redirect(new URL(`/configuracoes?google=${q}`, url.origin))

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (url.searchParams.get('error') || !code) return to('error')

  // CSRF: o user_id vem do state ASSINADO (não do browser). State inválido/forjado/vencido → aborta.
  const userId = verifyState(state)
  if (!userId) return to('error')

  const tokens = await exchangeCodeForTokens(code)
  if (!tokens?.access_token) return to('error')

  const email = await fetchGoogleEmail(tokens.access_token)
  await saveTokensForUser(userId, { ...tokens, google_email: email })

  return to('connected')
}
