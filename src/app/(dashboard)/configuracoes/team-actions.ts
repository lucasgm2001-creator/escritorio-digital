'use server'

import { createInvite, revokeInvite } from '@/server/services/TeamService'
import { getRequestContext } from '@/server/context/request-context'

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nao foi possivel concluir a acao.'
}

export async function createTeamInviteAction(): Promise<ActionResult<Awaited<ReturnType<typeof createInvite>>>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

  try {
    const invite = await createInvite(context)
    return { ok: true, data: invite }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

export async function revokeTeamInviteAction(inviteId: string): Promise<ActionResult<{ id: string }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessao expirada. Entre novamente.' }

  try {
    await revokeInvite(context, inviteId)
    return { ok: true, data: { id: inviteId } }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}
