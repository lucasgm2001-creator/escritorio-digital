import type { ReactNode } from 'react'

// Cabeçalho ÚNICO de workspace (EXPERIENCE-001): eyebrow + título + descrição curta + KPIs + ações.
// Uma só implementação — os cabeçalhos por módulo apontam para aqui, eliminando variações.
// `size`: 'default' (home de módulo, text-2xl) | 'compact' (sub-seção dentro de um workspace, text-xl).
export function WorkspaceHeader({ eyebrow, title, subtitle, kpis, actions, size = 'default' }: {
  eyebrow?: string
  title: string
  subtitle?: string
  kpis?: ReactNode
  actions?: ReactNode
  size?: 'default' | 'compact'
}) {
  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          {eyebrow && <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">{eyebrow}</p>}
          <h1 className={`font-display font-bold text-bento-text ${size === 'compact' ? 'text-xl' : 'text-2xl'}`}>{title}</h1>
          {subtitle && <p className="text-sm text-bento-muted max-w-prose">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {kpis && <div>{kpis}</div>}
    </header>
  )
}
