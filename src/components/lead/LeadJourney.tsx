import { Fragment } from 'react'
import { Check, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadJourneyStep } from '@/lib/commercial/lead-hub-types'

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : ''
}

// Linha do tempo visual (LEAD-002): jornada Lead criado → Contato → Reunião → Proposta → Fechamento → Cliente.
export function LeadJourney({ steps }: { steps: LeadJourneyStep[] }) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-0">
      {steps.map((step, i) => (
        <Fragment key={step.key}>
          <div className={cn(
            'min-w-[8rem] flex-1 rounded-bento border p-2.5 text-center',
            step.done ? 'border-lime/40 bg-lime/10' : 'border-bento-border bg-bento-panel/40',
          )}>
            <div className={cn(
              'w-6 h-6 rounded-full mx-auto flex items-center justify-center mb-1',
              step.done ? 'bg-lime text-lime-ink' : 'bg-bento-panel border border-bento-border text-bento-dim',
            )}>
              {step.done ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-tech">{i + 1}</span>}
            </div>
            <p className={cn('text-[12px] font-medium leading-tight break-words', step.done ? 'text-lime-fg' : 'text-bento-muted')}>{step.label}</p>
            {step.at && <p className="text-[10px] text-bento-dim mt-0.5">{fmtDate(step.at)}</p>}
          </div>
          {i < steps.length - 1 && (
            <div className="flex items-center justify-center text-bento-dim">
              <ChevronDown className="w-4 h-4 lg:hidden" />
              <ChevronRight className="hidden lg:block w-4 h-4" />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}
