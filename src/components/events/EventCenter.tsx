import { ArrowRight } from 'lucide-react'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { cn } from '@/lib/utils'
import { EVENT_CATALOG, EVENT_CATEGORIES, eventsByCategory } from '@/lib/events/catalog'
import type { EventPriority } from '@/lib/events/types'
import { EventRuntimePanel } from './EventRuntimePanel'

// Event Center (EVENT-001 + runtime EVENT-002). Catálogo ESTÁTICO + runtime EM MEMÓRIA (EventRuntimePanel).
// Nenhuma persistência, nenhum módulo real reage. Reusa WorkspaceHeader/MetricCard/Panel/EmptyState (DS).
const PRIORITY_TINT: Record<EventPriority, string> = {
  low: 'text-bento-dim', normal: 'text-bento-muted', high: 'text-amber-400', critical: 'text-red-400',
}

export function EventCenter() {
  const totalEvents = EVENT_CATALOG.length
  const totalCategories = EVENT_CATEGORIES.filter(c => eventsByCategory(c.key).length > 0).length
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        breadcrumb={['Administração', 'Eventos']}
        title="Event Bus"
        subtitle="A espinha dorsal de eventos do Escritório Digital. Runtime em memória ativo (sem fila/persistência/banco) — publique um evento de teste abaixo; nenhum módulo real reage ainda."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <MetricCard title="Eventos no catálogo" value={totalEvents} size="sm" />
        <MetricCard title="Categorias" value={totalCategories} size="sm" />
        <MetricCard title="Runtime" value="Em memória" size="sm" tone="muted" />
        <MetricCard title="Persistência" value="Nenhuma" size="sm" tone="muted" />
      </div>

      {/* Runtime ao vivo (EVENT-002) — subscribers registrados + últimos eventos + publicar teste. */}
      <EventRuntimePanel />

      {/* Catálogo por categoria (estático — Parts 3/4 do EVENT-001). */}
      <div className="space-y-4">
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
