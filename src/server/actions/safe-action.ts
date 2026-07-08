import 'server-only'

import { can } from '@/lib/permissions/can'
import type { PermissionAction, PermissionModule } from '@/lib/permissions/types'
import { getRequestContext, type RequestContext } from '@/server/context/request-context'
import { hasActiveTeam, type RequestContextWithActiveTeam } from '@/server/context/active-team'

export type ActionError = { message: string; code?: string } | null

type RequireActionContextOptions = {
  permission?: {
    module: PermissionModule
    action: PermissionAction
  }
  authorize?: (context: RequestContext) => boolean
  deniedMessage?: string
  expiredMessage?: string
  requireActiveTeam?: boolean
  noActiveTeamMessage?: string
}

type ActionContextResult =
  | { context: RequestContext; error: null }
  | { context: null; error: NonNullable<ActionError> }

type ActiveTeamActionContextResult =
  | { context: RequestContextWithActiveTeam; error: null }
  | { context: null; error: NonNullable<ActionError> }

export function pickAllowed(
  input: Record<string, unknown>,
  cols: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of cols) {
    if (key in input) out[key] = input[key]
  }
  return out
}

export function toActionError(error: { message: string; code?: string } | null | undefined): ActionError {
  return error ? { message: error.message, ...(error.code ? { code: error.code } : {}) } : null
}

export async function requireActionContext(
  options: RequireActionContextOptions & { requireActiveTeam: true },
): Promise<ActiveTeamActionContextResult>
export async function requireActionContext(options?: RequireActionContextOptions): Promise<ActionContextResult>
export async function requireActionContext(options: RequireActionContextOptions = {}): Promise<ActionContextResult | ActiveTeamActionContextResult> {
  const {
    permission,
    authorize,
    deniedMessage = 'Você não tem permissão para executar esta ação.',
    expiredMessage = 'Sessão expirada. Entre novamente.',
    requireActiveTeam = false,
    noActiveTeamMessage = 'Selecione uma equipe ativa.',
  } = options

  const context = await getRequestContext()
  if (!context) return { context: null, error: { message: expiredMessage } }

  if (requireActiveTeam && !hasActiveTeam(context)) {
    return { context: null, error: { message: noActiveTeamMessage } }
  }

  if (permission && !can(context, permission.module, permission.action)) {
    return { context: null, error: { message: deniedMessage } }
  }

  if (authorize && !authorize(context)) {
    return { context: null, error: { message: deniedMessage } }
  }

  return { context, error: null }
}
