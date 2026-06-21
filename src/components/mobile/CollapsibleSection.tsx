'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Caixa retrátil PADRÃO da reforma mobile. Uma só fronteira: <1024px = mobile.
 *
 * - Mobile (<1024px): cabeçalho clicável (título Space Grotesk + chevron que gira) que abre/fecha
 *   o conteúdo. `defaultOpen` decide o estado inicial (a seção principal de cada área começa aberta).
 * - Desktop (≥1024px): NÃO muda nada. O wrapper e o cabeçalho somem da árvore (`lg:contents` +
 *   `lg:hidden`) e os `children` renderizam EXATAMENTE no lugar, sem chrome novo e SEM duplicar
 *   (instância única — nada de efeito colateral dobrado em filhos com fetch/realtime).
 */
interface Props {
  title: string
  icon?: LucideIcon
  defaultOpen?: boolean
  badge?: ReactNode
  children: ReactNode
  /** classes extras aplicadas só ao wrapper mobile (no desktop o wrapper vira `contents`). */
  className?: string
}

export function CollapsibleSection({ title, icon: Icon, defaultOpen = false, badge, children, className }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cn('lg:contents', className)}>
      {/* Cabeçalho — só mobile */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn(
          'lg:hidden w-full flex items-center gap-2.5 px-4 py-3 min-h-[44px] text-left rounded-bento border border-bento-border bg-bento-panel transition-colors',
          open && 'rounded-b-none',
        )}
      >
        {Icon && <Icon className="w-4 h-4 text-lime-fg flex-none" />}
        <span className="font-display font-bold text-bento-text text-sm flex-1 min-w-0 truncate">{title}</span>
        {badge != null && <span className="font-tech text-[10px] text-bento-muted tabular-nums flex-none">{badge}</span>}
        <ChevronDown className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', open && 'rotate-180')} />
      </button>

      {/* Conteúdo — instância única. Desktop: `lg:contents` (renderiza no lugar, sem chrome). */}
      <div
        className={cn(
          'lg:contents',
          open
            ? 'block rounded-b-bento border border-t-0 border-bento-border bg-bento-panel px-4 pb-4 pt-3'
            : 'hidden',
        )}
      >
        {children}
      </div>
    </div>
  )
}
