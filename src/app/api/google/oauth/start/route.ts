import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { requireAuth } from '@/lib/supabase/require-auth'
import { getOAuthClient, GOOGLE_OAUTH_SCOPES } from '@/lib/google/oauth'

// Inicia o consentimento OAuth do Google. Exige sessão (senão 401). Gera state (CSRF) em cookie httpOnly e
// redireciona pro Google. googleapis precisa de Node (não Edge).
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const oauth = getOAuthClient()
  if (!oauth) return NextResponse.json({ error: 'OAuth do Google não configurado (env ausente)' }, { status: 500 })

  const state = randomBytes(32).toString('hex')
  const url = oauth.generateAuthUrl({
    access_type: 'offline',        // pede refresh_token
    prompt: 'consent',             // força o consentimento (garante refresh_token no 1º OK)
    scope: GOOGLE_OAUTH_SCOPES,
    include_granted_scopes: true,
    state,
  })

  const res = NextResponse.redirect(url)
  // state em cookie httpOnly/seguro; sameSite=lax p/ voltar no redirect top-level do Google. Some em 10min.
  res.cookies.set('g_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 })
  return res
}
