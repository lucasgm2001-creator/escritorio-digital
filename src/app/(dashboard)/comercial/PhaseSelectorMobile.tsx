'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usdCompact } from '@/lib/format'
import { StaticLeadCard } from './LeadCard'
import { type ColumnConfig, type Lead } from './types'

/**
 * Funil no MOBILE (<1024px): ACORDEÃO VERTICAL — todas as fases como caixas empilhadas, TODAS
 * começando FECHADAS. Clicar no cabeçalho inteiro abre/fecha (várias podem ficar abertas).
 * COR POR FASE (identidade fixa por slug) só em 2 lugares: barra de 3px na borda esquerda + um
 * pontinho ao lado do nome (nunca o fundo). SEM arrastar: tocar no card abre o LeadDiary.
 * Desktop continua com colunas + arrastar (cores do desktop intocadas).
 */

// Cor fixa por slug de fase (identidade visual). Fallback neutro p/ fases customizadas.
const PHASE_COLOR: Record<string, string> = {
  novo: '#5B93C7',
  interagiu: '#54B981',
  nao_interagiu: '#E9B23A',
  reuniao: '#54B981',
  no_show: '#EF6A4D',
  reagendamento: '#E9B23A',
  proposta: '#E9B23A',
  negocio_futuro: '#E9B23A',
  fechado: '#22C55E',
  perdido: '#E23B30',
  lixeira: '#717784',
}
const colorOf = (slug: string) => PHASE_COLOR[slug] ?? '#717784'

export function PhaseSelectorMobile({ columns, leads, onOpenDiary }: {
  columns: ColumnConfig[]
  leads: Lead[]
  onOpenDiary: (l: Lead) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())   // todas FECHADAS por padrão
  const toggle = (k: string) =>
    setOpen(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <div className="space-y-2 max-w-2xl mx-auto">
      {columns.map(col => {
        const phaseLeads = leads.filter(l => l.status === col.key)
        const total = phaseLeads.reduce((s, l) => s + (l.value || 0), 0)
        const color = colorOf(col.key)
        const isOpen = open.has(col.key)
        return (
          <div key={col.key} className="bento-fx overflow-hidden" style={{ borderLeft: `3px solid ${color}` }}>
            {/* Cabeçalho INTEIRO clicável (a seta é só indicador). */}
            <button type="button" onClick={() => toggle(col.key)} aria-expanded={isOpen}
              className="w-full flex items-center gap-2.5 px-3 py-3 min-h-[56px] text-left">
              <span className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-bento-text text-sm truncate">{col.label}</span>
                  <span className="font-tech text-[11px] text-bento-muted tabular-nums flex-none">({phaseLeads.length})</span>
                </div>
                {total > 0 && <span className="font-tech text-[11px] text-bento-dim tabular-nums">{usdCompact(total)}</span>}
              </div>
              <ChevronDown className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', isOpen && 'rotate-180')} />
            </button>

            {/* Leads (empilhados). SEM arrastar — StaticLeadCard; tocar abre o LeadDiary.
                O "Xd parado"/próximo passo vem da lógica de dias do próprio card (independe da cor da fase). */}
            {isOpen && (
              <div className="px-2 pb-2 pt-1 space-y-2 border-t border-bento-border/60">
                {phaseLeads.length === 0
                  ? <p className="text-center text-xs text-bento-muted/60 py-3 font-tech">Nenhum lead nesta fase.</p>
                  : phaseLeads.map(l => <StaticLeadCard key={l.id} lead={l} onClick={() => onOpenDiary(l)} />)}
              </div>
            )}
          </div>
        )
      })}
      <p className="font-tech text-[10px] text-bento-muted/70 text-center px-2 pt-1">
        Toque numa fase para abrir · toque num card para abrir e mover de fase
      </p>
    </div>
  )
}
