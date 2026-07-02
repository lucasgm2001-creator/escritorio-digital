import type { LeadExecutive, LeadTemperature } from '@/lib/commercial/lead-hub-types'

const TEMP: Record<LeadTemperature, string> = { quente: '🔥 Quente', morno: '🌤 Morno', frio: '❄️ Frio' }

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

// Painel Executivo (LEAD-002): indicadores rápidos. score é real; chance é placeholder (IA/Forecast).
export function LeadExecutivePanel({ executive }: { executive: LeadExecutive }) {
  const items: { label: string; value: string }[] = [
    { label: 'Lead Score', value: executive.score != null ? String(executive.score) : '—' },
    { label: 'Chance', value: executive.chance != null ? `${executive.chance}%` : '—' },
    { label: 'Temperatura', value: TEMP[executive.temperature] },
    { label: 'Status', value: executive.status ?? '—' },
    { label: 'Tempo médio/fase', value: executive.avgDaysPerStage != null ? `${executive.avgDaysPerStage}d` : '—' },
    { label: 'Última atividade', value: fmtDate(executive.lastActivityAt) },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {items.map(item => (
        <div key={item.label} className="bento-fx p-3">
          <p className="font-display font-bold text-base text-bento-text leading-none truncate">{item.value}</p>
          <p className="text-[11px] text-bento-muted mt-1.5 truncate">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
