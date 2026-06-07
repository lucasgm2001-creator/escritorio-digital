import { cn } from '@/lib/utils'
import { LiveDot } from './LiveDot'
import type { PanelSpan } from './Panel'

const SPAN_CLS: Record<PanelSpan, string> = {
  hero: 'sm:col-span-2 sm:row-span-2',
  tall: 'sm:row-span-2',
  wide: 'sm:col-span-2',
  '1':  '',
}

interface AgentPanelProps {
  span?: PanelSpan
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  children?: React.ReactNode
}

// Painel de destaque do Agente: FUNDO inteiro no acento, texto escuro (#0A0C10).
// Botão de ação invertido (fundo escuro, texto acento). É o único bloco grande
// no acento da tela — o que cria a hierarquia "high level" sem exagerar.
export function AgentPanel({
  span = 'wide', title, description, actionLabel, onAction, className, children,
}: AgentPanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col min-w-0 rounded-bento bg-lime text-lime-ink p-4',
        SPAN_CLS[span],
        className,
      )}
    >
      <div className="flex items-center gap-2 shrink-0">
        <LiveDot tone="ink" />
        <span className="font-tech text-[10px] uppercase tracking-wider text-lime-ink/70">Agente</span>
      </div>

      <h3 className="font-display font-bold text-lg leading-tight mt-2">{title}</h3>
      <p className="font-body text-sm text-lime-ink/80 mt-1 flex-1 min-h-0">{description}</p>

      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-3 self-start inline-flex items-center gap-2 rounded-btn bg-lime-ink text-lime px-4 min-h-[44px] text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {actionLabel}
        </button>
      )}
      {children}
    </section>
  )
}
