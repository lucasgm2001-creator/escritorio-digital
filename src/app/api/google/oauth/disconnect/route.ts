import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { deleteTokensForUser } from '@/lib/google/oauth'

// Desconecta o Google do usuário logado: apaga a linha (service role). Node runtime.
export const runtime = 'nodejs'

export async function POST() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const r = await deleteTokensForUser(auth.user.id)
  return NextResponse.json(r, { status: r.ok ? 200 : 500 })
}
