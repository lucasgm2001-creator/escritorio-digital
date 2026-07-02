import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import { getAdminSection, type AdminSectionKey } from '@/lib/admin/sections'
import { ModelBlueprint } from './ModelBlueprint'
import { CompensationFlow } from './CompensationFlow'
import { AdminStat } from './AdminStat'
import { AdminEmptyState } from './AdminEmptyState'

// Módulo administrativo profissional: cabeçalho + contexto ("como funciona") + indicadores +
// estrutura oficial + o que viverá aqui + estado vazio elegante. Nenhuma regra de negócio nesta fase.
export function AdminSectionView({ sectionKey }: { sectionKey: AdminSectionKey }) {
  const section = getAdminSection(sectionKey)
  if (!section) notFound()

  const Icon = section.icon

  return (
    <div className="space-y-6 md:space-y-7">
      {/* Voltar — só no celular (push). No iPad/Desktop a rail mantém a seleção. */}
      <Link href="/admin" className="md:hidden inline-flex items-center gap-1 text-sm text-bento-muted min-h-[44px]">
        <ChevronLeft className="w-4 h-4" /> Administração
      </Link>

      <header className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-bento bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-lime-fg" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl text-bento-text">{section.label}</h1>
            <span className="text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border border-bento-border text-bento-dim">
              Em breve
            </span>
          </div>
          <p className="text-sm text-bento-muted mt-1">{section.tagline}</p>
        </div>
      </header>

      {section.context && (
        <div className="rounded-bento border border-bento-border bg-bento-panel/30 p-4">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Como funciona</p>
          <p className="text-[13px] text-bento-dim leading-relaxed">{section.context}</p>
        </div>
      )}

      {section.metrics && section.metrics.length > 0 && (
        <div>
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Indicadores</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {section.metrics.map(label => (
              <AdminStat key={label} label={label} value="—" hint="aguardando dados" />
            ))}
          </div>
        </div>
      )}

      {section.blueprint === 'compensation' && (
        <Panel label="Fluxo de remuneração">
          <CompensationFlow />
        </Panel>
      )}
      {section.blueprint === 'people' && (
        <Panel label="Estrutura oficial">
          <ModelBlueprint kind="people" />
        </Panel>
      )}

      <Panel label="O que viverá aqui">
        <ul className="space-y-2">
          {section.planned.map(item => (
            <li key={item} className="flex items-start gap-2 text-sm text-bento-text">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <AdminEmptyState
        icon={Icon}
        title={section.emptyTitle ?? 'Em construção'}
        description={section.emptyHint ?? 'Este módulo está sendo preparado sobre a fundação da Administração.'}
        hint="Estrutura definida pela Constituição do Escritório Digital."
      />
    </div>
  )
}
