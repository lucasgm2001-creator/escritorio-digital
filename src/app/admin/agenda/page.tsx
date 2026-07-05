import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { listCollaboratorCards } from '@/server/services/PeopleService'
import { AgendaAdminClient } from './AgendaAdminClient'

// Agendas (Administração, ACCESS-ROLES-001 Parte 6). O /admin já é gated por canAccessAdmin (owner/dev) no
// layout, então esta página herda o gate. Lista os colaboradores REAIS (reuso do PeopleService) e delega a
// visão da agenda ao client (que carrega os eventos sob demanda, só leitura, reusando calendar_events).
export default async function AdminAgendaPage() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  const collaborators = context ? await listCollaboratorCards(context) : []
  return (
    <AgendaAdminClient
      collaborators={collaborators.map(c => ({ userId: c.userId, name: c.name, roleName: c.roleName, avatarUrl: c.avatarUrl }))}
    />
  )
}
