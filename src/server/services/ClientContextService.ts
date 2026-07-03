import 'server-only'

import { cache } from 'react'
import type { RequestContext } from '@/server/context/request-context'
import type { LeadHubVM } from '@/lib/commercial/lead-hub-types'
import { getLeadHub } from './LeadHubService'
import { getLeadIdForClient } from '@/server/repositories/ClientRepository'

// Contexto comercial do cliente (CLIENT-005). Resolve o LEAD de origem (deals.client_id → lead_id) e
// REUSA o LeadHub (jornada + timeline + saúde do lead). Cacheado por request → Timeline, Resumo e Agenda
// compartilham UMA leitura (PERFORMANCE, Parte 11). null = cliente sem lead de origem (nada a mesclar).
export const getClientLeadHub = cache(async (context: RequestContext, clientId: string): Promise<LeadHubVM | null> => {
  const leadId = await getLeadIdForClient(clientId)
  if (!leadId) return null
  return getLeadHub(context, leadId)
})
