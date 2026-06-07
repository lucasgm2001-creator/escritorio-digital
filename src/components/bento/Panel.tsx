import { cn } from '@/lib/utils'

export type PanelSpan = 'hero' | 'tall' | 'wide' | '1'

// Spans do grid bento (4 colunas no desktop). No mobile o grid cai pra 1/2
// colunas, então os spans só valem a partir de sm/lg para não estourar.
const SPAN_CLS: Record<PanelSpan, string> = {
  hero: 'sm:col-span-2 sm:row-span-2',
  tall: 'sm:row-span-2',
  wide: 'sm:col-span-2',
  '1':  '',
}

interface PanelProps {
  span?: PanelSpan
  /** Label de seção: uppercase, mono, muted, 10px. */
  label?: string
  /** Conteúdo no canto direito do cabeçalho (ex: botão, LiveDot). */
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

/** Card base do design system: bg --panel, borda 1px --border, radius 14px. */
export function Panel({ span = '1', label, action, className, bodyClassName, children }: PanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col min-w-0 rounded-bento border border-bento-border bg-bento-panel p-3.5',
        SPAN_CLS[span],
        className,
      )}
    >
      {(label || action) && (
        <div className="flex items-center justify-between gap-2 mb-2.5 shrink-0">
          {label && (
            <span className="font-tech text-[10px] uppercase tracking-wider text-bento-muted truncate">
              {label}
            </span>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn('flex flex-col min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}
