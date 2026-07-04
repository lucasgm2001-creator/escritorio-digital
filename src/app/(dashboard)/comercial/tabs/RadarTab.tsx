'use client'

import { useMemo, useState } from 'react'
import { Radar, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { SituationDrawer } from '../SituationDrawer'
import type { Lead } from '../types'
import {
  FOLLOWUP_STATE_LABEL, LAST_ACTION_LABEL, NEXT_ACTION_LABEL, TEMPERATURE_LABEL, temperatureFromScore,
  type FollowupState, type Temperature, type LastAction, type NextAction,
} from '@/lib/commercial/situation'

// Radar Comercial (RADAR-COMERCIAL-001, Part 4) — situação de acompanhamento de cada lead num painel moderno.
// Reusa os leads já carregados (têm os campos de situação). Estado/temperatura vêm dos campos explícitos ou
// são derivados (honesto). "Ação rápida" abre o mesmo fluxo do drawer. Estados vazios honestos (Part 6).

type Filter = 'hoje' | 'aguardando' | 'sem_atualizacao' | 'quentes' | 'todos'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'hoje', label: 'Precisa agir hoje' },
  { key: 'aguardando', label: 'Aguardando resposta' },
  { key: 'sem_atualizacao', label: 'Sem atualização' },
  { key: 'quentes', label: 'Quentes' },
  { key: 'todos', label: 'Todos' },
]

const TEMP_DOT: Record<Temperature, string> = {
  frio: 'bg-blue-400', morno: 'bg-amber-400', quente: 'bg-orange-400', muito_quente: 'bg-red-500',
}
const STATE_BADGE: Record<FollowupState, string> = {
  precisa_agir: 'text-red-400 border-red-500/30 bg-red-500/10',
  aguardando: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  agendado: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
  sem_atualizacao: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
  desistiu: 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10',
  fechado: 'text-lime-fg border-lime/30 bg-lime/10',
  perdido: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
}

function tempOf(l: Lead): Temperature | null {
  return (l.temperature as Temperature) || temperatureFromScore(l.score)
}
function stateOf(l: Lead, today: string): FollowupState {
  if (l.followup_state) return l.followup_state as FollowupState
  if (l.status === 'fechado') return 'fechado'
  if (l.status === 'perdido') return 'perdido'
  if (l.next_contact && l.next_contact <= today) return 'precisa_agir'
  if (l.last_contact_at && !l.next_contact) return 'aguardando'
  if (!l.current_situation && !l.last_action) return 'sem_atualizacao'
  return 'aguardando'
}

export function RadarTab({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState<Filter>('hoje')
  const [patches, setPatches] = useState<Record<string, Record<string, unknown>>>({})
  const [active, setActive] = useState<Lead | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const rows = useMemo(() => {
    const eff = leads
      .map(l => (patches[l.id] ? { ...l, ...patches[l.id] } as Lead : l))
      .filter(l => l.status !== 'lixeira')
    return eff.map(l => ({ lead: l, temp: tempOf(l), state: stateOf(l, today) }))
  }, [leads, patches, today])

  const counts = useMemo(() => ({
    hoje: rows.filter(r => r.state === 'precisa_agir').length,
    aguardando: rows.filter(r => r.state === 'aguardando').length,
    sem_atualizacao: rows.filter(r => r.state === 'sem_atualizacao').length,
    quentes: rows.filter(r => r.temp === 'quente' || r.temp === 'muito_quente').length,
    todos: rows.length,
  }), [rows])

  const shown = rows.filter(r => {
    if (filter === 'todos') return true
    if (filter === 'quentes') return r.temp === 'quente' || r.temp === 'muito_quente'
    return r.state === filter
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={cn('px-3 py-1.5 rounded-full border text-[13px] transition-colors min-h-[36px] inline-flex items-center gap-1.5',
              filter === f.key ? 'bg-lime/15 border-lime text-lime-fg' : 'border-bento-border text-bento-muted hover:text-bento-text')}>
            {f.label}
            <span className="text-[10px] opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Radar} title="Nada neste filtro" description="Nenhum lead se encaixa aqui agora. Troque o filtro ou atualize a situação de um lead pela ação rápida." />
      ) : (
        <div className="space-y-2">
          {shown.map(({ lead, temp, state }) => (
            <div key={lead.id} className="bento-fx p-3.5 flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <span className={cn('mt-1 w-2.5 h-2.5 rounded-full shrink-0', temp ? TEMP_DOT[temp] : 'bg-bento-muted')} title={temp ? TEMPERATURE_LABEL[temp] : 'Temperatura não definida'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-bento-text truncate">{lead.name}</span>
                    {lead.company && <span className="text-[12px] text-bento-muted truncate">· {lead.company}</span>}
                  </div>
                  <p className="text-[13px] text-bento-muted mt-0.5">{lead.current_situation || <span className="text-bento-dim italic">Sem situação registrada</span>}</p>
                </div>
                <span className={cn('text-[9px] font-tech uppercase tracking-wide px-1.5 py-0.5 rounded-full border shrink-0', STATE_BADGE[state])}>{FOLLOWUP_STATE_LABEL[state]}</span>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-bento-dim pl-5">
                <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap">
                  <span>Última: <span className="text-bento-muted">{lead.last_action ? LAST_ACTION_LABEL[lead.last_action as LastAction] : 'Aguardando primeira atualização'}</span></span>
                  <span>Próxima: <span className="text-bento-muted">{lead.next_action && lead.next_action !== 'nenhuma' ? NEXT_ACTION_LABEL[lead.next_action as NextAction] : 'Sem próxima ação'}</span></span>
                  {lead.next_contact && <span>Quando: <span className="text-bento-muted">{lead.next_contact}</span></span>}
                  {lead.assigned_name && <span>Resp: <span className="text-bento-muted">{lead.assigned_name}</span></span>}
                </div>
                <button type="button" onClick={() => setActive(lead)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-lime-fg hover:underline shrink-0">
                  Ação rápida <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <SituationDrawer
          lead={{ id: active.id, name: active.name }}
          onClose={() => setActive(null)}
          onSaved={({ patch }) => { setPatches(prev => ({ ...prev, [active.id]: { ...prev[active.id], ...patch } })); setActive(null) }}
        />
      )}
    </div>
  )
}
