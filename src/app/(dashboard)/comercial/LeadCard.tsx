'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { getScoreInfo } from '@/lib/utils/score'
import type { Lead } from './types'

interface Props {
  lead: Lead
  isDragging?: boolean
  onClick?: () => void
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase()
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `R$ ${(val / 1_000).toFixed(0)}k`
  if (val > 0)          return `R$ ${val.toLocaleString('pt-BR')}`
  return ''
}

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa:   'text-slate-400 border-slate-700/60',
  media:   'text-blue-400 border-blue-800/50',
  alta:    'text-amber-400 border-amber-800/50',
  urgente: 'text-red-400 border-red-800/50',
}

export function LeadCard({ lead, isDragging, onClick }: Props) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id })

  const scoreInfo = getScoreInfo(lead.score)
  const scorePct  = Math.min(100, (lead.score / 1000) * 100)
  const isClient  = lead.status === 'fechado'
  const formattedValue = formatValue(lead.value || 0)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : (isClient ? 0.6 : 1),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bento-fx p-3 cursor-pointer select-none',
        'hover:border-lime/50 transition-colors duration-150',
        isDragging && 'shadow-card-hover rotate-1 scale-105 border-lime',
      )}
    >
      {/* Top row */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border',
          scoreInfo.bg, scoreInfo.color, scoreInfo.border,
        )}>
          <span className={cn('w-1 h-1 rounded-full flex-none', scoreInfo.dot)} />
          {scoreInfo.faixa}
        </span>

        {lead.prioridade && lead.prioridade !== 'media' && (
          <span className={cn(
            'inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded border capitalize',
            PRIORIDADE_COLORS[lead.prioridade] ?? ''
          )}>
            {lead.prioridade}
          </span>
        )}

        {isClient && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 text-[10px] font-bold">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Cliente
          </span>
        )}

        {formattedValue && (
          <span className="ml-auto font-tech text-[10px] font-bold text-bento-dim tabular-nums">
            {formattedValue}
          </span>
        )}
      </div>

      {/* Name + company */}
      <p className="font-semibold text-bento-text text-sm leading-snug truncate">{lead.name}</p>
      {lead.company && (
        <p className="text-[11px] text-bento-muted truncate mt-0.5">{lead.company}</p>
      )}
      {lead.nicho && (
        <p className="text-[10px] text-bento-dim truncate mt-0.5">{lead.nicho}</p>
      )}

      {/* Score bar */}
      <div className="mt-2.5">
        <div className="w-full h-1 bg-bento-border rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', scoreInfo.dot)}
            style={{ width: `${scorePct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="font-tech text-[10px] text-bento-muted">
            {lead.operation === 'eua' ? 'EUA' : 'BR'}
          </span>
          <span className="font-tech text-[10px] text-bento-muted tabular-nums font-medium">{lead.score}</span>
        </div>
      </div>

      {/* Assigned avatar */}
      {lead.assigned_name && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-bento-border/60">
          <div className="w-[18px] h-[18px] rounded-md bg-bento-bg border border-bento-border flex items-center justify-center flex-none">
            <span className="text-[9px] font-bold text-bento-dim">{getInitials(lead.assigned_name)}</span>
          </div>
          <span className="text-[10px] text-bento-muted truncate">{lead.assigned_name}</span>
        </div>
      )}
    </div>
  )
}
