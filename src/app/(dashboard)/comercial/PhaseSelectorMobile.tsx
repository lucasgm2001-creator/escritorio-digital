'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { LeadCard } from './LeadCard'
import { type ColumnConfig, type Lead } from './types'

/**
 * Funil no MOBILE: as fases viram um SELETOR de chips compactos (grid, sem rolagem
 * horizontal apertada). Uma fase por vez: tocar num chip mostra os leads daquela fase
 * abaixo. Cada card é arrastável (mesmo DndContext/handler do desktop — arraste até um
 * chip pra mover) e tocar abre o LeadDiary. Desktop continua com as colunas (KanbanColumn).
 */

// Chip de fase: clicável (seleciona) + droppable (id = col.key, igual à coluna do desktop,
// então o handleDragEnd existente resolve o move sem mudar nada).
function PhaseChip({ col, count, active, onSelect }: {
  col: ColumnConfig; count: number; active: boolean; onSelect: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: col.key })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      title={col.label}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-2 rounded-btn border px-2.5 py-2 min-h-[44px] text-left transition-colors',
        active ? 'border-lime/60 bg-lime/10' : 'border-bento-border bg-bento-panel hover:border-lime/40',
        isOver && 'border-dashed border-lime/70 bg-lime/5',
      )}
    >
      <span className={cn('w-[7px] h-[7px] rounded-full flex-none', col.dotColor)} />
      <span className={cn('text-xs font-semibold flex-1 min-w-0 truncate', active ? 'text-lime-fg' : 'text-bento-text')}>{col.label}</span>
      <span className="font-display text-sm font-bold tabular-nums text-bento-text flex-none">{count}</span>
    </button>
  )
}

export function PhaseSelectorMobile({ columns, leads, onOpenDiary }: {
  columns: ColumnConfig[]
  leads: Lead[]
  onOpenDiary: (l: Lead) => void
}) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of columns) m[c.key] = 0
    for (const l of leads) if (l.status in m) m[l.status]++
    return m
  }, [columns, leads])

  // Default: primeira fase COM leads (senão a primeira). Só no mount.
  const firstWithLeads = columns.find(c => counts[c.key] > 0)?.key ?? columns[0]?.key ?? ''
  const [selected, setSelected] = useState<string>(firstWithLeads)

  // Se a fase selecionada deixar de existir (configuração mudou), reescolhe — sem
  // sobrescrever a escolha do usuário em refresh de dados.
  useEffect(() => {
    if (!columns.some(c => c.key === selected)) setSelected(firstWithLeads)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns])

  const selectedCol = columns.find(c => c.key === selected) ?? columns[0]
  const phaseLeads = leads.filter(l => l.status === selected)

  return (
    <div className="space-y-3">
      {/* Seletor de fases — chips compactos (cabem na tela, sem rolagem horizontal) */}
      <div className="grid grid-cols-2 gap-1.5">
        {columns.map(col => (
          <PhaseChip
            key={col.key}
            col={col}
            count={counts[col.key] ?? 0}
            active={col.key === selected}
            onSelect={() => setSelected(col.key)}
          />
        ))}
      </div>

      {/* Leads da fase selecionada (uma por vez) */}
      <div className="bento-fx p-2.5">
        <div className="flex items-center gap-2 mb-2.5">
          <span className={cn('w-[7px] h-[7px] rounded-full flex-none', selectedCol?.dotColor ?? 'bg-bento-muted')} />
          <span className="text-sm font-semibold text-bento-text flex-1 min-w-0 truncate">{selectedCol?.label ?? 'Fase'}</span>
          <span className="font-tech text-[10px] text-bento-muted tabular-nums">{phaseLeads.length} {phaseLeads.length === 1 ? 'lead' : 'leads'}</span>
        </div>
        <SortableContext items={phaseLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {phaseLeads.length === 0 ? (
            <p className="text-center text-xs text-bento-muted/60 py-6 font-tech">Nenhum lead nesta fase.</p>
          ) : (
            <div className="space-y-2">
              {phaseLeads.map(l => <LeadCard key={l.id} lead={l} onClick={() => onOpenDiary(l)} />)}
            </div>
          )}
        </SortableContext>
      </div>

      <p className="font-tech text-[10px] text-bento-muted/70 text-center px-2">
        Toque num card para abrir · segure e arraste até uma fase para mover
      </p>
    </div>
  )
}
