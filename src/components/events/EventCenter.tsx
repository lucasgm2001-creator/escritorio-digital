import { ArrowRight } from 'lucide-react'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { Panel } from '@/components/bento/Panel'
import { TimeAgo } from '@/components/system/TimeAgo'
import { cn } from '@/lib/utils'
import { EVENT_CATALOG, EVENT_CATEGORIES, eventsByCategory } from '@/lib/events/catalog'
import type { EventPriority } from '@/lib/events/types'
import type { ActivityEntry } from '@/server/services/AdminOverviewService'

// Event Center (ADMIN-REAL-001): eventos PUBLICADOS de verdade (feed `activities`) + o catálogo de tipos que
// o sistema define (origem → destino). Tudo real, nada em memória. Reusa WorkspaceHeader/MetricCard/Panel/TimeAgo.
const PRIORITY_TINT: Record<EventPriority, string> = {
  low: 'text-bento-dim', normal: 'text-bento-muted', high: 'text-amber-400', critical: 'text-red-400',
}

export function EventCenter({ published }: { published: { total: number; recent: ActivityEntry[] } }) {
  const totalEvents = EVENT_CATALOG.length
  const totalCategories = EVENT_CATEGORIES.filter(c => eventsByCategory(c.key).length > 0).length

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        breadcrumb={['Administração', 'Eventos']}
        title="Eventos"
        subtitle="Os eventos publicados pela plataforma e o catálogo de tipos que o sistema define."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <MetricCard title="Eventos publicados" value={published.total} size="sm" tone={published.total > 0 ? 'positive' : 'muted'} />
        <MetricCard title="Tipos no catálogo" value={totalEvents} size="sm" />
        <MetricCard title="Categorias" value={totalCategories} size="sm" />
      </div>

      {/* Eventos publicados REAIS (feed de atividades). */}
      <Panel label="Últimos eventos publicados">
        {published.recent.length === 0 ? (
          <p className="text-[13px] text-bento-muted">Nenhum evento registrado.</p>
        ) : (
          <ul className="-my-1 divide-y divide-bento-border">
            {published.recent.map(ev => (
              <li key={ev.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 text-[10px] font-tech uppercase tracking-wide text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">{ev.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-bento-text leading-snug">{ev.description}</p>
                  <p className="text-[11px] text-bento-muted mt-0.5">
                    {ev.user_name ?? 'Sistema'}{ev.created_at && <> · <TimeAgo date={ev.created_at} /></>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Catálogo de TIPOS de evento que o sistema define (origem → destinos). Referência real do sistema. */}
      <div className="space-y-4">
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Catálogo de tipos</p>
        {EVENT_CATEGORIES.map(cat => {
          const events = eventsByCategory(cat.key)
          if (events.length === 0) return null
          return (
            <div key={cat.key}>
              <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">{cat.label}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {events.map(ev => (
                  <div key={ev.type} className="bento-fx p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-tech text-[13px] text-bento-text truncate">{ev.type}</span>
                      <span className={cn('font-tech text-[10px] uppercase tracking-wide shrink-0', PRIORITY_TINT[ev.priority])}>{ev.priority}</span>
                    </div>
                    <p className="text-[12px] text-bento-muted mt-1 leading-relaxed">{ev.description}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px] text-bento-dim">
                      <span className="border border-bento-border rounded-full px-1.5 py-0.5">de: {ev.source}</span>
                      <ArrowRight className="w-3 h-3 shrink-0" />
                      {ev.targets.map(t => <span key={t} className="border border-bento-border rounded-full px-1.5 py-0.5">{t}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
