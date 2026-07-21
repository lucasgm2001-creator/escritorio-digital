import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

// Cabeçalho ÚNICO de workspace (EXPERIENCE-001) + breadcrumb global (EXPERIENCE-006). Uma só implementação:
// os cabeçalhos por módulo apontam para aqui. `breadcrumb` (['Clientes','Acme','Financeiro']) é o padrão
// global de trilha "onde estou"; quando ausente, usa `eyebrow`. `kpis` = indicadores de contexto (o que
// estou vendo); `actions` = ações rápidas (o que posso fazer). `size`: 'default' (home, text-2xl) |
// 'compact' (sub-seção, text-xl).
export function WorkspaceHeader({ eyebrow, breadcrumb, title, subtitle, kpis, actions, size = 'default' }: {
  eyebrow?: string
  breadcrumb?: string[]
  title: string
  subtitle?: string
  kpis?: ReactNode
  actions?: ReactNode
  size?: 'default' | 'compact'
}) {
  const trail = breadcrumb?.filter(Boolean) ?? []
  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          {trail.length > 0 ? (
            <nav aria-label="Trilha" className="flex items-center gap-1 flex-wrap font-tech text-[11px] uppercase tracking-[0.14em]">
              {trail.map((seg, i) => (
                <span key={`${i}-${seg}`} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-bento-dim shrink-0" aria-hidden />}
                  <span className={`truncate ${i === trail.length - 1 ? 'text-lime-fg' : 'text-bento-muted'}`}>{seg}</span>
                </span>
              ))}
            </nav>
          ) : eyebrow ? (
            <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">{eyebrow}</p>
          ) : null}
          <h1 className={`font-display font-bold text-bento-text break-words ${size === 'compact' ? 'text-xl' : 'text-2xl'}`}>{title}</h1>
          {subtitle && <p className="text-sm text-bento-muted max-w-prose break-words">{subtitle}</p>}
        </div>
        {actions && <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap sm:justify-end">{actions}</div>}
      </div>
      {kpis && <div>{kpis}</div>}
    </header>
  )
}
