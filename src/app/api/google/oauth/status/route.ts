import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { getTokenRow } from '@/lib/google/oauth'

// Status da conexão Google do usuário logado: { connected, email }. Token lido via service role.
export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const row = await getTokenRow(auth.user.id)
  const connected = !!(row && (row.refresh_token || row.access_token))
  return NextResponse.json({ connected, email: row?.google_email ?? null })
}
