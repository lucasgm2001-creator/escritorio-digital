import { FolderOpen } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { listDepartmentSummaries } from '@/server/services/PeopleService'
import { Panel } from '@/components/bento/Panel'
import { ModelBlueprint } from '@/components/admin/ModelBlueprint'
import { PeopleHeader } from '@/components/people/PeopleHeader'
import { DepartmentCard } from '@/components/people/DepartmentCard'

export default async function DepartamentosPage() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  const departments = context ? await listDepartmentSummaries(context) : []

  return (
    <div className="space-y-6">
      <PeopleHeader
        icon={FolderOpen}
        title="Departamentos"
        tagline="As áreas da empresa — o topo da estrutura de pessoas."
        badge="Catálogo padrão"
      />

      <Panel label="Estrutura oficial">
        <ModelBlueprint kind="people" />
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {departments.map(department => (
          <DepartmentCard key={department.id} department={department} />
        ))}
      </div>
    </div>
  )
}
