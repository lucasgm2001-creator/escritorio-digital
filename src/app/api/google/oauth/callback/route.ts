import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/supabase/require-auth'
import { getOAuthClient, saveTokensForUser, emailFromIdToken } from '@/lib/google/oauth'

// Retorno do consentimento Google. VALIDA o state (CSRF) contra o cookie, confirma a SESSÃO (só vincula na
// conta logada — anti-vincular-na-conta-errada), troca code→tokens e salva (service role). googleapis = Node.
export const runtime = 'nodejs'

function back(req: Request, path: string) {
  return new URL(path, new URL(req.url).origin)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const clearState = (res: NextResponse) => { res.cookies.delete('g_oauth_state'); return res }

  if (oauthError) return clearState(NextResponse.redirect(back(req, '/configuracoes?google=erro')))

  // CSRF: o state tem que existir e bater com o cookie httpOnly.
  const cookieState = cookies().get('g_oauth_state')?.value
  if (!code || !state || !cookieState || state !== cookieState) {
    return clearState(NextResponse.redirect(back(req, '/configuracoes?google=erro')))
  }

  // Sessão Supabase: vincula SOMENTE na conta logada.
  const auth = await requireAuth()
  if ('error' in auth) return clearState(NextResponse.redirect(back(req, '/login')))

  const oauth = getOAuthClient()
  if (!oauth) return clearState(NextResponse.redirect(back(req, '/configuracoes?google=erro')))

  try {
    const { tokens } = await oauth.getToken(code)   // troca code por tokens (usa client_id/secret/redirect_uri)
    await saveTokensForUser(auth.user.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,   // só vem no 1º consentimento; saveTokens preserva se vier null
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      google_email: emailFromIdToken(tokens.id_token),
    })
  } catch (e) {
    console.error('[google-oauth] callback troca de code FALHOU:', (e as Error)?.message ?? e)
    return clearState(NextResponse.redirect(back(req, '/configuracoes?google=erro')))
  }

  return clearState(NextResponse.redirect(back(req, '/configuracoes?google=ok')))
}
