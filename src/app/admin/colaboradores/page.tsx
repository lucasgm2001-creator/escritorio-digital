import { Users } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { getPeopleOverview, listCollaboratorCards } from '@/server/services/PeopleService'
import { Panel } from '@/components/bento/Panel'
import { ModelBlueprint } from '@/components/admin/ModelBlueprint'
import { PeopleHeader } from '@/components/people/PeopleHeader'
import { CollaboratorCard } from '@/components/people/CollaboratorCard'

export default async function ColaboradoresPage() {
  const context = await getRequestContext()
  const [collaborators, overview] = context
    ? await Promise.all([listCollaboratorCards(context), getPeopleOverview(context)])
    : [[], { departments: 0, roles: 0, templates: 0, collaborators: 0 }]

  return (
    <div className="space-y-6">
      <PeopleHeader
        icon={Users}
        title="Colaboradores"
        tagline="As pessoas da empresa — muito além de vendedores."
        badge="Prévia"
        stats={[
          { label: 'departamentos', value: overview.departments },
          { label: 'cargos', value: overview.roles },
          { label: 'pessoas', value: overview.collaborators },
        ]}
      />

      <div className="rounded-frame border border-lime/20 bg-lime/5 p-4">
        <p className="text-sm text-bento-text font-medium">Fundação do domínio de Pessoas</p>
        <p className="text-[12px] text-bento-muted mt-1 leading-relaxed">
          Estrutura de exemplo. A gestão real (departamento, cargo, template, gestor, status, histórico,
          documentos e integrações) chega nas próximas fases, sobre esta mesma arquitetura.
        </p>
      </div>

      <Panel label="Estrutura oficial">
        <ModelBlueprint kind="people" />
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {collaborators.map(collaborator => (
          <CollaboratorCard key={collaborator.id} collaborator={collaborator} example />
        ))}
      </div>
    </div>
  )
}
