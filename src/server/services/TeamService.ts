import 'server-only'

import { requirePermission } from '@/lib/permissions/require-permission'
import type { RequestContext } from '@/server/context/request-context'
import {
  createTeamInvite,
  getTeamInvites,
  getTeamMembers,
  revokeTeamInvite,
  type TeamInvite,
  type TeamMember,
} from '@/server/repositories/TeamRepository'

export class ActiveTeamRequiredError extends Error {
  readonly code = 'ACTIVE_TEAM_REQUIRED'

  constructor() {
    super('Active team is required')
    this.name = 'ActiveTeamRequiredError'
  }
}

function requireActiveTeamId(context: RequestContext): string {
  if (!context.activeTeamId) {
    throw new ActiveTeamRequiredError()
  }

  return context.activeTeamId
}

export async function getActiveTeamMembers(
  context: RequestContext,
): Promise<TeamMember[]> {
  const activeTeamId = requireActiveTeamId(context)

  return getTeamMembers(activeTeamId)
}

export async function getActiveTeamInvites(
  context: RequestContext,
): Promise<TeamInvite[]> {
  const activeTeamId = requireActiveTeamId(context)
  requirePermission(context, 'teams', 'manage')

  return getTeamInvites(activeTeamId)
}

export async function createInvite(context: RequestContext): Promise<TeamInvite> {
  const activeTeamId = requireActiveTeamId(context)
  requirePermission(context, 'teams', 'manage')

  return createTeamInvite(activeTeamId, context.user.id)
}

export async function revokeInvite(
  context: RequestContext,
  inviteId: string,
): Promise<void> {
  const activeTeamId = requireActiveTeamId(context)
  requirePermission(context, 'teams', 'manage')

  await revokeTeamInvite(activeTeamId, inviteId)
}
