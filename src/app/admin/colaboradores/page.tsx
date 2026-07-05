import { Users } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { getPeopleOverview, listCollaboratorCards } from '@/server/services/PeopleService'
import { Panel } from '@/components/bento/Panel'
import { ModelBlueprint } from '@/components/admin/ModelBlueprint'
import { PeopleHeader } from '@/components/people/PeopleHeader'
import { CollaboratorCard } from '@/components/people/CollaboratorCard'
import { EmptyState } from '@/components/ui/EmptyState'

export default async function ColaboradoresPage() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  const [collaborators, overview] = context
    ? await Promise.all([listCollaboratorCards(context), getPeopleOverview(context)])
    : [[], { departments: 0, roles: 0, templates: 0, collaborators: 0 }]

  return (
    <div className="space-y-6">
      <PeopleHeader
        icon={Users}
        title="Colaboradores"
        tagline="As pessoas da empresa — muito além de vendedores."
        stats={[
          { label: 'departamentos', value: overview.departments },
          { label: 'cargos', value: overview.roles },
          { label: 'pessoas', value: overview.collaborators },
        ]}
      />

      {collaborators.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {collaborators.map(collaborator => (
            <CollaboratorCard key={collaborator.id} collaborator={collaborator} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="Nenhum colaborador nesta equipe"
          description="Os membros do workspace aparecem aqui automaticamente. Convide pessoas pela Central de Equipe."
        />
      )}

      <Panel label="Estrutura oficial">
        <ModelBlueprint kind="people" />
      </Panel>
    </div>
  )
}
