import { Briefcase } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { listRoleSummaries } from '@/server/services/PeopleService'
import type { RoleSummary } from '@/lib/people/types'
import { PeopleHeader } from '@/components/people/PeopleHeader'
import { RoleCard } from '@/components/people/RoleCard'

export default async function CargosPage() {
  const context = await getRequestContext()
  const roles = context ? await listRoleSummaries(context) : []

  // Agrupa por departamento — ensina naturalmente a relação Departamento → Cargo.
  const groups = new Map<string, RoleSummary[]>()
  for (const role of roles) {
    const key = role.departmentName ?? 'Sem departamento'
    const current = groups.get(key) ?? []
    current.push(role)
    groups.set(key, current)
  }

  return (
    <div className="space-y-6">
      <PeopleHeader
        icon={Briefcase}
        title="Cargos"
        tagline="A função profissional — não define permissão nem remuneração."
        badge="Catálogo padrão"
      />

      {Array.from(groups.entries()).map(([department, items]) => (
        <section key={department} className="space-y-3">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">{department}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map(role => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
