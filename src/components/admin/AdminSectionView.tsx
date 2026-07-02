import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import { getAdminSection, type AdminSectionKey } from '@/lib/admin/sections'
import { ModelBlueprint } from './ModelBlueprint'

// Base de todas as seções da Administração: cabeçalho + placeholder elegante ("Em breve") +
// (quando aplicável) a estrutura OFICIAL. Nenhuma regra de negócio nesta fase.
export function AdminSectionView({ sectionKey }: { sectionKey: AdminSectionKey }) {
  const section = getAdminSection(sectionKey)
  if (!section) notFound()

  const Icon = section.icon

  return (
    <div className="space-y-6">
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

      <p className="text-sm text-bento-dim leading-relaxed">{section.description}</p>

      {section.blueprint && (
        <Panel label="Estrutura oficial">
          <ModelBlueprint kind={section.blueprint} />
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

      <p className="text-[11px] text-bento-dim">
        Estrutura definida pela Constituição do Escritório Digital · sem regras de negócio nesta fase.
      </p>
    </div>
  )
}
