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
  /** Painel herói: ganha o filete de acento no topo. Use em UM bloco por tela. */
  hero?: boolean
  /** Label de seção: uppercase, mono, muted, 10px. */
  label?: string
  /** Conteúdo no canto direito do cabeçalho (ex: botão, LiveDot). */
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  /** Classes extras no cabeçalho (label+action). Ex.: "max-lg:hidden" p/ esconder no mobile quando
      uma CollapsibleSection já fornece o título — desktop intocado. */
  headerClassName?: string
  children: React.ReactNode
}

/**
 * Card base do design system "Bento Compacto". O acabamento (gradação sutil,
 * borda, inset highlight no topo, radius 16px, filete do herói) vem da classe
 * `.bento-fx` em globals.css — valores copiados de painel_padrao_tecnico.html.
 */
export function Panel({ span = '1', hero = false, label, action, className, bodyClassName, headerClassName, children }: PanelProps) {
  return (
    <section
      className={cn(
        'bento-fx flex flex-col min-w-0 p-5',
        hero && 'is-hero',
        SPAN_CLS[span],
        className,
      )}
    >
      {(label || action) && (
        <div className={cn('flex items-center justify-between gap-2 mb-4 shrink-0', headerClassName)}>
          {label && (
            <span className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted truncate">
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
