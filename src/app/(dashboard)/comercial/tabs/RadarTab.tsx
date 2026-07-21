'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Radar, ArrowRight, ThermometerSun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Lead } from '../types'
import type { FunnelStage } from '@/lib/funnelStages'
import {
  TEMPERATURE_LABEL, isTemperature, relativeDayLabel, temperatureFromScore, temperatureRank,
  type Temperature,
} from '@/lib/commercial/situation'

// O Radar é leitura comercial, não uma segunda lista de tarefas. Ele responde “quem está quente,
// morno ou esfriando?”; compromissos, prazos e próximas ações pertencem exclusivamente a Tarefas.
type Filter = 'quentes' | 'mornos' | 'esfriando' | 'frios' | 'nao_avaliados' | 'todos'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'quentes', label: 'Quentes' },
  { key: 'esfriando', label: 'Esfriando' },
  { key: 'mornos', label: 'Mornos' },
  { key: 'frios', label: 'Frios' },
  { key: 'nao_avaliados', label: 'Não avaliados' },
  { key: 'todos', label: 'Todos' },
]

const TEMP_DOT: Record<Temperature, string> = {
  frio: 'bg-blue-400', morno: 'bg-amber-400', quente: 'bg-orange-400', muito_quente: 'bg-red-500',
  muito_interessado: 'bg-red-500', interessado: 'bg-orange-400', em_duvida: 'bg-amber-400',
  pensando: 'bg-amber-400', esfriando: 'bg-red-400', pouco_interessado: 'bg-blue-400',
  nao_interessado: 'bg-zinc-500', nao_avaliado: 'bg-bento-border',
}

const TEMP_BADGE: Record<'hot' | 'warm' | 'cooling' | 'cold' | 'unknown', string> = {
  hot: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
  warm: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  cooling: 'text-red-300 border-red-500/30 bg-red-500/10',
  cold: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
  unknown: 'text-bento-muted border-bento-border bg-bento-bg',
}

function bucketOf(temp: Temperature | null): Exclude<Filter, 'todos'> {
  if (temp === 'muito_quente' || temp === 'muito_interessado' || temp === 'quente' || temp === 'interessado') return 'quentes'
  if (temp === 'morno' || temp === 'em_duvida' || temp === 'pensando') return 'mornos'
  if (temp === 'esfriando' || temp === 'pouco_interessado') return 'esfriando'
  if (temp === 'frio' || temp === 'nao_interessado') return 'frios'
  return 'nao_avaliados'
}

function daysSince(iso: string, today: string): number {
  const from = new Date(`${iso.slice(0, 10)}T12:00:00`).getTime()
  const to = new Date(`${today}T12:00:00`).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(0, Math.floor((to - from) / 86_400_000))
}

function toneOf(bucket: Exclude<Filter, 'todos'>): keyof typeof TEMP_BADGE {
  if (bucket === 'quentes') return 'hot'
  if (bucket === 'mornos') return 'warm'
  if (bucket === 'esfriando') return 'cooling'
  if (bucket === 'frios') return 'cold'
  return 'unknown'
}

function stageName(status: string, stages: FunnelStage[]): string {
  return stages.find(stage => stage.slug === status)?.nome
    ?? status.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase())
}

export function RadarTab({ leads, stages = [] }: { leads: Lead[]; stages?: FunnelStage[] }) {
  const [filter, setFilter] = useState<Filter>('quentes')
  const today = new Date().toISOString().slice(0, 10)

  const rows = useMemo(() => leads
    .filter(lead => {
      const stage = stages.find(item => item.slug === lead.status)
      return lead.status !== 'lixeira' && lead.status !== 'fechado' && lead.status !== 'perdido'
        && !stage?.is_won && !stage?.is_lost
    })
    .map(lead => {
      const explicit = isTemperature(lead.temperature) ? lead.temperature : null
      const temp = explicit ?? temperatureFromScore(lead.score)
      const lastSignalAt = lead.situation_updated_at ?? lead.last_contact_at ?? lead.stage_changed_at ?? lead.received_at ?? lead.created_at
      const inactiveDays = daysSince(String(lastSignalAt), today)
      const coolingAfter = stages.find(stage => stage.slug === lead.status)?.dias_esfriamento ?? 7
      const naturallyCooling = inactiveDays >= coolingAfter
      const bucket = naturallyCooling ? 'esfriando' as const : bucketOf(temp)
      return { lead, temp, bucket, lastSignalAt, inactiveDays, naturallyCooling }
    })
    .sort((a, b) => {
      const byTemp = temperatureRank(b.temp) - temperatureRank(a.temp)
      if (byTemp) return byTemp
      return String(b.lastSignalAt).localeCompare(String(a.lastSignalAt))
    }), [leads, stages, today])

  const counts = useMemo(() => ({
    quentes: rows.filter(row => row.bucket === 'quentes').length,
    mornos: rows.filter(row => row.bucket === 'mornos').length,
    esfriando: rows.filter(row => row.bucket === 'esfriando').length,
    frios: rows.filter(row => row.bucket === 'frios').length,
    nao_avaliados: rows.filter(row => row.bucket === 'nao_avaliados').length,
    todos: rows.length,
  }), [rows])

  const shown = filter === 'todos' ? rows : rows.filter(row => row.bucket === filter)

  return (
    <div className="p-3 sm:p-4 max-w-3xl mx-auto space-y-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="rounded-bento border border-bento-border bg-bento-panel/60 p-3 flex items-start gap-3">
        <ThermometerSun className="w-4 h-4 text-lime-fg mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-bento-text">Radar mostra sinais, não pendências</p>
          <p className="text-caption text-bento-muted mt-0.5">Use esta área para ler a temperatura da carteira. Ligações, follow-ups e reuniões ficam em Tarefas.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1">
        {FILTERS.map(item => (
          <button key={item.key} type="button" onClick={() => setFilter(item.key)}
            className={cn('shrink-0 px-3 py-1.5 rounded-full border text-note transition-colors min-h-control-sm inline-flex items-center gap-1.5',
              filter === item.key ? 'bg-lime/15 border-lime text-lime-fg' : 'border-bento-border text-bento-muted hover:text-bento-text')}>
            {item.label}
            <span className={cn('text-label tabular-nums', filter === item.key ? 'opacity-80' : 'opacity-60')}>{counts[item.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Radar} title="Nenhum lead neste sinal"
          description="A leitura muda conforme a equipe registra as interações e a percepção do lead." />
      ) : (
        <div className="space-y-2">
          {shown.map(({ lead, temp, bucket, lastSignalAt, inactiveDays, naturallyCooling }) => (
            <Link key={lead.id} href={`/comercial?lead=${encodeURIComponent(lead.id)}`}
              className="w-full text-left bento-fx p-3.5 flex flex-col gap-2 hover:border-lime/40 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={cn('w-2 h-2 rounded-full shrink-0', temp ? TEMP_DOT[temp] : 'bg-bento-border')} />
                <span className="text-[15px] font-semibold text-bento-text truncate flex-1 min-w-0">{lead.name}</span>
                {lead.company && <span className="hidden sm:inline text-caption text-bento-muted truncate max-w-[28%]">{lead.company}</span>}
                <span className={cn('text-label font-tech uppercase tracking-label px-2 py-0.5 rounded-full border shrink-0', TEMP_BADGE[toneOf(bucket)])}>
                  {naturallyCooling ? 'Esfriando' : temp ? TEMPERATURE_LABEL[temp] : 'Não avaliado'}
                </span>
              </div>
              <div className="flex items-center gap-x-2 gap-y-1 flex-wrap pl-[18px] text-caption text-bento-muted">
                <span>{stageName(lead.status, stages)}</span>
                <span aria-hidden>·</span>
                <span>Score {lead.score ?? 0}</span>
                <span aria-hidden>·</span>
                <span>{naturallyCooling ? `${inactiveDays}d sem sinal novo` : `último sinal ${relativeDayLabel(String(lastSignalAt), today) ?? 'sem data'}`}</span>
                {naturallyCooling && temp && <><span aria-hidden>·</span><span>última leitura: {TEMPERATURE_LABEL[temp]}</span></>}
                {lead.current_situation && <><span aria-hidden>·</span><span className="truncate max-w-full sm:max-w-[45%]">{lead.current_situation}</span></>}
                {lead.assigned_name && <span className="sm:ml-auto">Resp. {lead.assigned_name}</span>}
                <ArrowRight className="w-3.5 h-3.5 text-bento-dim shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
