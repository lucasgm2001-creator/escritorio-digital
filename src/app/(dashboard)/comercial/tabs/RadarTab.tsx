'use client'

import { useMemo, useState } from 'react'
import { Radar, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { SituationDrawer } from '../SituationDrawer'
import type { Lead } from '../types'
import type { FunnelStage } from '@/lib/funnelStages'
import {
  FOLLOWUP_STATE_LABEL, TEMPERATURE_LABEL, deriveLeadSituation, relativeDayLabel,
  type FollowupState, type Temperature, type StageFacts, type LeadSituationInput,
} from '@/lib/commercial/situation'

// Radar Comercial = FILA OPERACIONAL (PRODUCT-SPRINT-003, PARTE EXTRA). O vendedor abre e sabe quem atacar
// primeiro: atrasados/hoje no topo. Situação e próxima ação são MANUAIS quando existem, senão DERIVADAS
// honestamente dos dados reais (fase do funil, última interação, next_contact, reunião/proposta/venda) — nunca
// inventa, nunca esconde. Rola de verdade: o container pai (KanbanBoard) dá a altura e o overflow.

type Filter = 'prioridade' | 'hoje' | 'quentes' | 'aguardando' | 'sem_atualizacao' | 'todos'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'prioridade', label: 'Atacar agora' },
  { key: 'hoje', label: 'Hoje/atrasados' },
  { key: 'quentes', label: 'Receptivos' },
  { key: 'aguardando', label: 'Pode esperar' },
  { key: 'sem_atualizacao', label: 'Sem plano' },
  { key: 'todos', label: 'Todos' },
]

const TEMP_DOT: Record<Temperature, string> = {
  frio: 'bg-blue-400', morno: 'bg-amber-400', quente: 'bg-orange-400', muito_quente: 'bg-red-500',
  muito_interessado: 'bg-red-500', interessado: 'bg-orange-400', em_duvida: 'bg-amber-400',
  pensando: 'bg-amber-400', esfriando: 'bg-red-400', pouco_interessado: 'bg-blue-400',
  nao_interessado: 'bg-zinc-500', nao_avaliado: 'bg-bento-border',
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

const isHotTemperature = (temp: Temperature | null): boolean =>
  temp === 'quente' || temp === 'muito_quente' || temp === 'interessado' || temp === 'muito_interessado'

const isColdTemperature = (temp: Temperature | null): boolean =>
  temp === 'frio' || temp === 'esfriando' || temp === 'pouco_interessado' || temp === 'nao_interessado'

const isOpenState = (state: FollowupState): boolean =>
  state !== 'fechado' && state !== 'perdido' && state !== 'desistiu'

const ACTION_BADGE = {
  danger: 'text-red-400 border-red-500/30 bg-red-500/10',
  hot: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
  warning: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  success: 'text-lime-fg border-lime/30 bg-lime/10',
  info: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
  muted: 'text-bento-muted border-bento-border bg-bento-bg',
} as const

type ActionBadgeTone = keyof typeof ACTION_BADGE
type RadarRow = {
  lead: Lead
  view: ReturnType<typeof deriveLeadSituation>
  priority: {
    label: string
    reason: string
    tone: ActionBadgeTone
  }
}

function priorityFor(lead: Lead, view: RadarRow['view'], today: string): RadarRow['priority'] {
  const next = lead.next_action ?? ''
  const due = view.nextWhen
  const dueTodayOrLate = !!due && due <= today

  if (view.state === 'precisa_agir' && next === 'ligar') {
    return { label: 'Ligar agora', reason: dueTodayOrLate ? 'Follow-up venceu' : 'Próxima ação é ligação', tone: 'danger' }
  }
  if (view.state === 'precisa_agir' && next === 'mensagem') {
    return { label: 'Enviar WhatsApp', reason: dueTodayOrLate ? 'Follow-up venceu' : 'Próxima ação é mensagem', tone: 'danger' }
  }
  if (view.state === 'precisa_agir' && next === 'cobrar_retorno') {
    return { label: 'Cobrar retorno', reason: dueTodayOrLate ? 'Retorno vencido' : 'Retorno marcado', tone: 'danger' }
  }
  if (view.state === 'precisa_agir') {
    return { label: 'Agir agora', reason: dueTodayOrLate ? 'Data de ação chegou' : 'Precisa de ação', tone: 'danger' }
  }
  if (view.state === 'sem_atualizacao') {
    return { label: 'Definir próximo passo', reason: 'Lead sem plano claro', tone: 'warning' }
  }
  if (isHotTemperature(view.temp)) {
    return { label: 'Alta chance', reason: 'Percepção positiva registrada', tone: 'hot' }
  }
  if (view.nextText.toLowerCase().includes('proposta')) {
    return { label: 'Cobrar proposta', reason: view.nextWhen ? `Marcado para ${relativeDayLabel(view.nextWhen, today)}` : 'Proposta em aberto', tone: 'info' }
  }
  if (view.state === 'agendado') {
    return { label: 'Pode esperar', reason: view.nextWhen ? `Agendado para ${relativeDayLabel(view.nextWhen, today)}` : 'Ação futura', tone: 'muted' }
  }
  if (view.state === 'aguardando') {
    return { label: 'Aguardando cliente', reason: isColdTemperature(view.temp) ? 'Baixo sinal de avanço' : 'Sem ação imediata', tone: 'muted' }
  }
  return { label: FOLLOWUP_STATE_LABEL[view.state], reason: view.situationDerived ? 'Derivado do funil' : 'Atualizado manualmente', tone: 'muted' }
}

// Fatos da fase (de funnel_stages) que a derivação precisa. Fallback honesto se a fase não veio do banco.
function stageFactsOf(status: string | null | undefined, stages: FunnelStage[]): StageFacts {
  const s = stages.find(x => x.slug === status) ?? null
  const slug = status ?? ''
  return {
    name: s?.nome ?? (slug ? slug[0].toUpperCase() + slug.slice(1) : 'Novo lead'),
    isWon: !!s?.is_won || slug === 'fechado',
    isLost: !!s?.is_lost || slug === 'perdido',
    isMeeting: !!s?.conta_reuniao || /reuni/i.test(slug) || /reuni/i.test(s?.nome ?? ''),
    isProposal: /propost/i.test(slug) || /propost/i.test(s?.nome ?? ''),
  }
}

export function RadarTab({ leads, stages = [] }: { leads: Lead[]; stages?: FunnelStage[] }) {
  const [filter, setFilter] = useState<Filter>('prioridade')
  const [patches, setPatches] = useState<Record<string, Record<string, unknown>>>({})
  const [active, setActive] = useState<Lead | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const rows = useMemo(() => leads
    .map(l => (patches[l.id] ? { ...l, ...patches[l.id] } as Lead : l))
    .filter(l => l.status !== 'lixeira')
    .map(l => {
      const view = deriveLeadSituation(l as LeadSituationInput, stageFactsOf(l.status, stages), today)
      return { lead: l, view, priority: priorityFor(l, view, today) }
    })
    .sort((a, b) => a.view.urgency - b.view.urgency),   // FILA: atrasados/hoje no topo; fechados no fim
  [leads, patches, stages, today])

  const counts = useMemo(() => ({
    prioridade: rows.filter(r => isOpenState(r.view.state) && (r.view.state === 'precisa_agir' || r.view.state === 'sem_atualizacao' || isHotTemperature(r.view.temp))).length,
    hoje: rows.filter(r => r.view.state === 'precisa_agir').length,
    aguardando: rows.filter(r => r.view.state === 'aguardando' || r.view.state === 'agendado').length,
    sem_atualizacao: rows.filter(r => r.view.state === 'sem_atualizacao').length,
    quentes: rows.filter(r => isHotTemperature(r.view.temp)).length,
    todos: rows.length,
  }), [rows])

  const shown = rows.filter(({ view }) => {
    if (filter === 'todos') return true
    if (filter === 'prioridade') return isOpenState(view.state) && (view.state === 'precisa_agir' || view.state === 'sem_atualizacao' || isHotTemperature(view.temp))
    if (filter === 'quentes') return isHotTemperature(view.temp)
    if (filter === 'aguardando') return view.state === 'aguardando' || view.state === 'agendado'
    return view.state === filter
  })

  return (
    <div className="p-3 sm:p-4 max-w-3xl mx-auto space-y-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      {/* Filtros — chips com contagem; rolam na horizontal no mobile sem cortar a lista */}
      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1">
        {FILTERS.map(f => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={cn('shrink-0 px-3 py-1.5 rounded-full border text-note transition-colors min-h-control-sm inline-flex items-center gap-1.5',
              filter === f.key ? 'bg-lime/15 border-lime text-lime-fg' : 'border-bento-border text-bento-muted hover:text-bento-text')}>
            {f.label}
            <span className={cn('text-label tabular-nums', filter === f.key ? 'opacity-80' : 'opacity-60')}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Radar} title={filter === 'hoje' ? 'Fila limpa por hoje' : 'Nada neste filtro'}
          description={filter === 'hoje' ? 'Ninguém está atrasado ou marcado para hoje. Confira "Aguardando" ou "Todos".' : 'Nenhum lead se encaixa aqui agora.'} />
      ) : (
        <div className="space-y-2">
          {shown.map(({ lead, view, priority }, index) => (
            <button key={lead.id} type="button" onClick={() => setActive(lead)}
              className={cn('w-full text-left bento-fx p-3.5 flex flex-col gap-2 hover:border-lime/40 transition-colors',
                index === 0 && filter === 'prioridade' && 'border-lime/40')}>
              {/* 1) Quem é + estado */}
              <div className="flex items-center gap-2.5">
                <span className={cn('w-2 h-2 rounded-full shrink-0', view.temp ? TEMP_DOT[view.temp] : 'bg-bento-border')} title={view.temp ? TEMPERATURE_LABEL[view.temp] : 'Sem temperatura'} />
                <span className="text-[15px] font-semibold text-bento-text truncate flex-1 min-w-0">{lead.name}</span>
                {lead.company && <span className="hidden sm:inline text-caption text-bento-muted truncate max-w-[28%]">{lead.company}</span>}
                <span className={cn('text-label font-tech uppercase tracking-label px-2 py-0.5 rounded-full border shrink-0', ACTION_BADGE[priority.tone])}>{priority.label}</span>
              </div>
              {/* 2) Situação (por quê) — manual ou derivada honesta */}
              <p className={cn('text-note leading-snug pl-[18px]', view.situationDerived ? 'text-bento-dim' : 'text-bento-muted')}>{priority.reason} · {view.situation}</p>
              {/* 3) Próxima ação + quando */}
              <div className="flex items-center justify-between gap-3 pl-[18px]">
                <span className="min-w-0 flex items-center gap-1.5 text-caption">
                  <ArrowRight className="w-3.5 h-3.5 text-bento-dim shrink-0" />
                  <span className={cn('truncate', view.nextText === '—' ? 'text-bento-dim' : 'text-bento-text')}>{view.nextText}</span>
                  {view.nextWhen && <span className={cn('shrink-0 font-tech', view.nextWhen <= today ? 'text-red-400 font-semibold' : 'text-bento-muted')}>· {relativeDayLabel(view.nextWhen, today)}</span>}
                </span>
                <span className={cn('hidden sm:inline text-label font-tech uppercase tracking-label px-2 py-0.5 rounded-full border shrink-0', STATE_BADGE[view.state])}>{FOLLOWUP_STATE_LABEL[view.state]}</span>
                {lead.assigned_name && <span className="hidden sm:inline text-caption text-bento-dim shrink-0">{lead.assigned_name}</span>}
              </div>
            </button>
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
