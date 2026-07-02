import { Fragment } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadPipelineStep } from '@/lib/commercial/lead-hub-types'

// Pipeline visual do lead: cada movimentação (quando entrou, quanto ficou, quem moveu). Responsivo.
export function LeadPipeline({ steps }: { steps: LeadPipelineStep[] }) {
  if (steps.length === 0) return <p className="text-sm text-bento-muted">Sem movimentações.</p>
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-stretch gap-2">
      {steps.map((step, i) => (
        <Fragment key={`${step.slug}-${i}`}>
          <div className={cn(
            'flex-1 min-w-[120px] rounded-bento border p-2.5',
            step.current ? 'border-lime/40 bg-lime/10' : 'border-bento-border bg-bento-panel/40',
          )}>
            <p className={cn('text-sm font-semibold truncate', step.current ? 'text-lime-fg' : 'text-bento-text')}>{step.stage}</p>
            <p className="text-[11px] text-bento-muted mt-0.5 truncate">
              {step.durationDays != null ? `${step.durationDays}d` : '—'}{step.movedBy ? ` · ${step.movedBy}` : ''}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div className="flex items-center justify-center text-bento-dim">
              <ChevronDown className="w-4 h-4 sm:hidden" />
              <ChevronRight className="hidden w-4 h-4 sm:block" />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}
