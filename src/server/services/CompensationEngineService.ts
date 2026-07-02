import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CompensationAssignment, CompensationEvent, CompensationPreview, CompensationTemplateDefinition } from '@/core/compensation/types'
import { computePreview } from '@/core/compensation/engine'
import { getActiveAssignment as repoAssignment, getTemplateById, listTemplates as repoListTemplates } from '@/server/repositories/CompensationTemplateRepository'

// Wiring da Compensation Engine (ARCH-001): resolve template/assignment via Repository (team-scoped,
// TEAM-001) e delega o CÁLCULO à engine PURA. Só leitura/preview — nada persiste.

export async function listTemplates(context: RequestContext): Promise<CompensationTemplateDefinition[]> {
  const teamId = context.activeTeamId
  if (!teamId) return []
  return repoListTemplates(teamId)
}

export async function getActiveAssignment(context: RequestContext, collaboratorId: string): Promise<CompensationAssignment | null> {
  const teamId = context.activeTeamId
  if (!teamId) return null
  return repoAssignment(teamId, collaboratorId)
}

export async function getActiveTemplate(context: RequestContext, collaboratorId: string): Promise<CompensationTemplateDefinition | null> {
  const teamId = context.activeTeamId
  if (!teamId) return null
  const assignment = await repoAssignment(teamId, collaboratorId)
  if (!assignment) return null
  return getTemplateById(teamId, assignment.templateId)
}

export async function getPreview(
  context: RequestContext,
  collaboratorId: string,
  event: Omit<CompensationEvent, 'collaboratorId'>,
): Promise<CompensationPreview | null> {
  const template = await getActiveTemplate(context, collaboratorId)
  if (!template) return null
  return computePreview(template, { ...event, collaboratorId })
}
