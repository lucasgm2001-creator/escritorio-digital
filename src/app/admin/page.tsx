import Link from 'next/link'
import { getRequestContext } from '@/server/context/request-context'
import { getPeopleOverview } from '@/server/services/PeopleService'
import { listTemplates } from '@/server/services/CompensationEngineService'
import { ADMIN_SECTIONS } from '@/lib/admin/sections'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

// Painel administrativo (não é só um menu): status real + ações rápidas + módulos com roadmap discreto.
const REAL = new Set(['equipe', 'departamentos', 'cargos', 'colaboradores', 'remuneracao'])

export default async function AdminHomePage() {
  const context = await getRequestContext()
  const [overview, templates] = context
    ? await Promise.all([getPeopleOverview(context), listTemplates(context)])
    : [{ departments: 0, roles: 0, templates: 0, collaborators: 0 }, []]

  const stats = [
    { label: 'Colaboradores', value: overview.collaborators, href: '/admin/colaboradores' },
    { label: 'Departamentos', value: overview.departments, href: '/admin/departamentos' },
    { label: 'Cargos', value: overview.roles, href: '/admin/cargos' },
    { label: 'Templates de remuneração', value: templates.length, href: '/admin/remuneracao' },
  ]
  const quick = [
    { label: 'Colaboradores', href: '/admin/colaboradores' },
    { label: 'Remuneração', href: '/admin/remuneracao' },
    { label: 'Equipe', href: '/admin/equipe' },
  ]

  return (
    <div className="space-y-6">
      <WorkspaceHeader breadcrumb={['Administração']} title="Painel administrativo" />

      {/* Status (dados reais) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href} className="bento-fx p-4 hover:border-lime/40 transition-colors">
            <p className="font-display font-bold text-2xl text-bento-text leading-none">{stat.value}</p>
            <p className="text-[11px] text-bento-muted mt-2 truncate">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Ações rápidas */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Ações rápidas</p>
        <div className="flex flex-wrap gap-2">
          {quick.map(action => (
            <Link key={action.href} href={action.href} className="bento-btn flex items-center px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold">
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Módulos (real x roadmap) */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Módulos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {ADMIN_SECTIONS.map(section => {
            const Icon = section.icon
            return (
              <Link key={section.key} href={section.href} className="bento-fx p-3 flex items-center gap-2.5 hover:border-lime/40 transition-colors">
                <div className="w-8 h-8 rounded-bento bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-lime-fg" />
                </div>
                <span className="text-sm font-medium text-bento-text truncate flex-1">{section.label}</span>
                {!REAL.has(section.key) && (
                  <span className="text-[9px] font-tech uppercase text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">roadmap</span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
