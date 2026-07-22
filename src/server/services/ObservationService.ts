import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { EntityObservation } from '@/lib/observations/types'
import { getEntityObservations } from '@/server/repositories/ObservationRepository'
import { getLeadById } from '@/server/repositories/LeadRepository'
import { getClientById, getLeadIdForClient } from '@/server/repositories/ClientRepository'

export async function getLeadObservations(context: RequestContext, leadId: string): Promise<EntityObservation[]> {
  if (!context.activeTeamId) return []
  const lead = await getLeadById(leadId)
  if (!lead || lead.team_id !== context.activeTeamId) return []
  return getEntityObservations(context.activeTeamId, 'lead', leadId)
}

export async function getClientObservations(context: RequestContext, clientId: string): Promise<EntityObservation[]> {
  if (!context.activeTeamId) return []
  const client = await getClientById(clientId)
  if (!client || client.team_id !== context.activeTeamId) return []
  const leadId = await getLeadIdForClient(clientId)
  const [clientNotes, leadNotes] = await Promise.all([
    getEntityObservations(context.activeTeamId, 'client', clientId),
    leadId ? getEntityObservations(context.activeTeamId, 'lead', leadId) : Promise.resolve([]),
  ])
  return [...clientNotes, ...leadNotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
