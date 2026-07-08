import 'server-only'

import type { RequestContext } from '@/server/context/request-context'

export class ActiveTeamRequiredError extends Error {
  readonly code = 'ACTIVE_TEAM_REQUIRED'

  constructor() {
    super('Active team is required')
    this.name = 'ActiveTeamRequiredError'
  }
}

export type RequestContextWithActiveTeam = RequestContext & { activeTeamId: string }

export function hasActiveTeam(context: RequestContext): context is RequestContextWithActiveTeam {
  return typeof context.activeTeamId === 'string' && context.activeTeamId.length > 0
}

export function requireActiveTeamId(context: RequestContext): string {
  if (!hasActiveTeam(context)) {
    throw new ActiveTeamRequiredError()
  }

  return context.activeTeamId
}
