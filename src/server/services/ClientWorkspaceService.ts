import 'server-only'

import { cache } from 'react'
import type { Client } from '@/app/(dashboard)/clientes/types'
import { getClientById } from '@/server/repositories/ClientRepository'
import { getRequestContext } from '@/server/context/request-context'

// Identidade do cliente para o Workspace (ARCH-001, TEAM-001). Confere a posse pela equipe ativa.
// cache() por request → o layout e a página de Resumo compartilham UMA leitura (sem consulta duplicada).
export const getClientWorkspace = cache(async (clientId: string): Promise<Client | null> => {
  const context = await getRequestContext()
  const teamId = context?.activeTeamId
  if (!teamId) return null
  const row = await getClientById(clientId)
  if (!row || row.team_id !== teamId) return null // ISOLAMENTO (TEAM-001)
  return row as unknown as Client
})
