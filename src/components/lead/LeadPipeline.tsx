import { cn } from '@/lib/utils'
import type { LeadPipelineStep } from '@/lib/commercial/lead-hub-types'

// Histórico comercial: linha CONTÍNUA de fases — o que mudou, quando entrou, tempo na fase, quem moveu.
function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

export function LeadPipeline({ steps }: { steps: LeadPipelineStep[] }) {
  if (steps.length === 0) return <p className="text-sm text-bento-muted">Sem movimentações.</p>
  return (
    <ol className="relative space-y-2">
      {/* trilho contínuo */}
      <span className="absolute left-[7px] top-2 bottom-2 w-px bg-bento-border" aria-hidden />
      {steps.map((step, i) => (
        <li key={`${step.slug}-${i}`} className="relative flex gap-3">
          <span className={cn(
            'relative z-10 mt-1.5 w-3.5 h-3.5 rounded-full border-2 shrink-0',
            step.current ? 'bg-lime border-lime' : 'bg-bento-bg border-bento-border',
          )} />
          <div className={cn(
            'flex-1 rounded-bento border px-2.5 py-2',
            step.current ? 'border-lime/40 bg-lime/10' : 'border-bento-border bg-bento-panel/40',
          )}>
            <div className="flex items-start justify-between gap-2">
              <p className={cn('text-sm font-semibold leading-snug break-words', step.current ? 'text-lime-fg' : 'text-bento-text')}>{step.stage}</p>
              {step.current && <span className="text-[9px] font-tech uppercase tracking-wide text-lime-fg shrink-0">atual</span>}
            </div>
            <p className="text-[11px] text-bento-muted mt-0.5">
              {fmtDate(step.enteredAt)}{step.durationDays != null ? ` · ${step.durationDays}d na fase` : ''}
            </p>
            {step.movedBy && <p className="text-[10px] text-bento-dim mt-0.5 break-words">por {step.movedBy}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
