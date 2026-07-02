import type { DomainSection } from '@/lib/domain/nav'

// Cartão de MÓDULO em roadmap (genérico): Status / Objetivo / Próxima etapa. Sem textos longos, sem
// back-link (a navegação vem do cabeçalho do domínio — rail no desktop, bottom sheet no mobile).
export function DomainSectionView({ section }: { section: DomainSection }) {
  const Icon = section.icon
  const cards: { label: string; value: string }[] = [
    { label: 'Status', value: 'Em roadmap' },
    { label: 'Objetivo', value: section.objetivo },
    { label: 'Próxima etapa', value: section.proximaEtapa },
  ]

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-bento bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-lime-fg" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl text-bento-text">{section.label}</h1>
            <span className="text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border border-bento-border text-bento-dim">Em roadmap</span>
          </div>
          <p className="text-sm text-bento-muted mt-1">{section.tagline}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {cards.map(card => (
          <div key={card.label} className="bento-fx p-3">
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">{card.label}</p>
            <p className="text-[13px] text-bento-text mt-1 leading-snug">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
