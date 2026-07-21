import Link from 'next/link'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { getAdminOverview } from '@/server/services/AdminOverviewService'
import { ADMIN_SECTIONS } from '@/lib/admin/sections'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { MetricCard } from '@/components/ui/MetricCard'

// Painel administrativo com DADOS REAIS (ADMIN-REAL-001): KPIs de Equipe/CRM/Financeiro/Sistema vindos do
// banco (escopados à equipe ativa). Módulos ainda sem dado próprio seguem marcados como roadmap, honestos.
const REAL = new Set(['equipe', 'departamentos', 'cargos', 'colaboradores', 'clientes', 'remuneracao', 'auditoria'])

export default async function AdminHomePage() {
  const context = await getRequestContext()
  // O painel/grid é de GESTÃO: quem entrou só pelo módulo Clientes vai direto para /admin/clientes.
  if (context) requireAdminManage(context)
  const overview = context ? await getAdminOverview(context) : { groups: [] }

  const quick = [
    { label: 'Colaboradores', href: '/admin/colaboradores' },
    { label: 'Remuneração', href: '/admin/remuneracao' },
    { label: 'Equipe', href: '/admin/equipe' },
  ]

  return (
    <div className="space-y-6">
      <WorkspaceHeader breadcrumb={['Administração']} title="Painel administrativo" />

      {/* KPIs REAIS por área — tudo do banco, escopado à equipe ativa (ADMIN-REAL-001). */}
      {overview.groups.map(group => (
        <section key={group.title} className="space-y-2">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">{group.title}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {group.metrics.map(m => (
              <MetricCard key={m.label} title={m.label} value={m.value} size="sm" href={m.href} />
            ))}
          </div>
        </section>
      ))}

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
                  <span className="text-[10px] font-tech uppercase text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">roadmap</span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
