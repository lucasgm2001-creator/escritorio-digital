'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { getLeadSignal, daysStopped, leadSubtitle, nextActionLabel, smartLeadBadges, type LeadSignal } from './leadSignals'
import { LeadSmartBadges } from './LeadSmartBadges'
import type { Lead } from './types'
import { usdCompact } from '@/lib/format'

interface Props {
  lead: Lead
  isDragging?: boolean
  onClick?: () => void
}

function formatValue(val: number): string {
  return val > 0 ? usdCompact(val) : ''
}

// Borda-esquerda do card por sinal (só quando há alerta).
const SIGNAL_BORDER: Record<LeadSignal, string> = {
  hot:  'border-l-2 border-l-lime',
  cold: 'border-l-2 border-l-red-400',
  warm: 'border-l-2 border-l-amber-400',
  none: '',
}

// Tag do rodapé por sinal (translúcida — funciona nos dois temas).
const SIGNAL_TAG: Record<Exclude<LeadSignal, 'none'>, string> = {
  hot:  'text-lime-fg bg-lime/15',
  cold: 'text-red-400 bg-red-400/[0.12]',
  warm: 'text-amber-400 bg-amber-400/[0.12]',
}

// Conteúdo visual do card (compartilhado entre a versão arrastável e a estática).
function LeadCardBody({ lead }: { lead: Lead }) {
  const signal = getLeadSignal(lead)
  const sub = leadSubtitle(lead)
  const hasSmartBadges = smartLeadBadges(lead).length > 0
  const formattedValue = formatValue(lead.value || 0)
  const nextAction = signal === 'none' ? nextActionLabel(lead) : null

  return (
    <>
      <p className="font-semibold text-bento-text text-xs coarse:text-sm leading-snug line-clamp-2 break-words" title={lead.name}>{lead.name}</p>
      {(sub || hasSmartBadges) && (
        <div className="mt-1 min-w-0 space-y-1">
          {sub && <span className="block w-full truncate font-tech text-[10px] coarse:text-[13px] text-bento-muted" title={sub}>{sub}</span>}
          <LeadSmartBadges lead={lead} max={sub ? 2 : 3} className="w-full" />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="font-tech text-[11px] coarse:text-[13px] font-semibold text-bento-dim tabular-nums">
          {formattedValue || '—'}
        </span>

        {signal !== 'none' ? (
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 py-px rounded font-tech text-[10px] font-bold uppercase tracking-wide',
            SIGNAL_TAG[signal],
          )}>
            <span className="w-1 h-1 rounded-full bg-current flex-none" />
            {signal === 'hot' ? 'Quente' : `${daysStopped(lead)}d`}
          </span>
        ) : nextAction ? (
          <span className="inline-flex items-center gap-1.5 font-tech text-[10px] coarse:text-[11px] text-bento-muted truncate">
            <span className="w-1 h-1 rounded-full bg-bento-muted flex-none" />
            {nextAction}
          </span>
        ) : null}
      </div>
    </>
  )
}

// Card arrastável (funil desktop, dentro de DndContext/SortableContext).
export function LeadCard({ lead, isDragging, onClick }: Props) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id })

  const signal = getLeadSignal(lead)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : (lead.status === 'fechado' ? 0.6 : 1),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bento-fx p-2.5 coarse:p-3.5 cursor-pointer select-none',
        'hover:border-lime/50 transition-[border-color,background-color,box-shadow] duration-150 ease-out',
        SIGNAL_BORDER[signal],
        isDragging && 'shadow-card-hover rotate-1 scale-105 border-lime',
      )}
    >
      <LeadCardBody lead={lead} />
    </div>
  )
}

// Card estático (acordeão mobile — sem drag, só clique p/ abrir o detalhe).
export function StaticLeadCard({ lead, onClick }: Props) {
  const signal = getLeadSignal(lead)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full text-left bento-fx p-2.5 coarse:p-3.5 cursor-pointer',
        'hover:border-lime/50 transition-[border-color,background-color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/50',
        SIGNAL_BORDER[signal],
        lead.status === 'fechado' && 'opacity-60',
      )}
    >
      <LeadCardBody lead={lead} />
    </button>
  )
}
