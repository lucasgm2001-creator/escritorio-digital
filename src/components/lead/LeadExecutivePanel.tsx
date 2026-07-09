import type { ReactNode } from 'react'
import type { LeadExecutive } from '@/lib/commercial/lead-hub-types'
import { LeadTemperatureBadge } from './lead-temperature-ui'

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

// Painel Executivo (LEAD-002): indicadores rápidos. score é real; chance é placeholder (IA/Forecast).
export function LeadExecutivePanel({ executive }: { executive: LeadExecutive }) {
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Lead Score', value: executive.score != null ? String(executive.score) : '—' },
    { label: 'Chance', value: executive.chance != null ? `${executive.chance}%` : '—' },
    { label: 'Temperatura', value: <LeadTemperatureBadge temperature={executive.temperature} /> },
    { label: 'Status', value: executive.status ?? '—' },
    { label: 'Tempo médio/fase', value: executive.avgDaysPerStage != null ? `${executive.avgDaysPerStage}d` : '—' },
    { label: 'Última atividade', value: fmtDate(executive.lastActivityAt) },
  ]
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-2.5">
      {items.map(item => (
        <div key={item.label} className="bento-fx min-w-0 p-3">
          <div className="font-display text-base font-bold leading-tight text-bento-text break-words">{item.value}</div>
          <p className="mt-1.5 text-[11px] text-bento-muted break-words">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
