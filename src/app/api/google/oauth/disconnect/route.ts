import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { getTokenRow, getOAuthClient, deleteTokensForUser } from '@/lib/google/oauth'

// Desconecta o Google do usuário logado: revoga no Google (best-effort) e apaga a linha (service role).
export const runtime = 'nodejs'

export async function POST() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const userId = auth.user.id

  // Best-effort: revoga o token no Google antes de apagar localmente (não falha se não der).
  try {
    const row = await getTokenRow(userId)
    const tok = row?.refresh_token || row?.access_token
    const oauth = getOAuthClient()
    if (tok && oauth) await oauth.revokeToken(tok).catch(() => {})
  } catch { /* best-effort */ }

  const r = await deleteTokensForUser(userId)
  return NextResponse.json(r, { status: r.ok ? 200 : 500 })
}
