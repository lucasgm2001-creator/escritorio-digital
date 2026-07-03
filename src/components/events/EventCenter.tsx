import { Radio, ArrowRight } from 'lucide-react'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { Panel } from '@/components/bento/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { EVENT_CATALOG, EVENT_CATEGORIES, eventsByCategory } from '@/lib/events/catalog'
import type { EventPriority } from '@/lib/events/types'

// Event Center (EVENT-001, Part 5). Estado VISUAL apenas — nenhum publisher/subscriber, nenhum evento
// publicado, nenhuma persistência. Reusa WorkspaceHeader/MetricCard/Panel/EmptyState (DS). Linguagem honesta.
const PRIORITY_TINT: Record<EventPriority, string> = {
  low: 'text-bento-dim', normal: 'text-bento-muted', high: 'text-amber-400', critical: 'text-red-400',
}

function StateRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-bento-border/60 last:border-0 text-[13px]">
      <span className="text-bento-text">{label}</span>
      <span className="font-tech text-[10px] uppercase tracking-wide text-bento-muted text-right">{status}</span>
    </div>
  )
}

export function EventCenter() {
  const totalEvents = EVENT_CATALOG.length
  const totalCategories = EVENT_CATEGORIES.filter(c => eventsByCategory(c.key).length > 0).length
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        breadcrumb={['Administração', 'Eventos']}
        title="Event Bus"
        subtitle="A espinha dorsal de eventos do Escritório Digital: como os módulos vão conversar sem se acoplar. Arquitetura preparada — nenhum publisher configurado, nenhum evento publicado."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <MetricCard title="Eventos no catálogo" value={totalEvents} size="sm" />
        <MetricCard title="Categorias" value={totalCategories} size="sm" />
        <MetricCard title="Publishers ativos" value={0} size="sm" tone="muted" />
        <MetricCard title="Eventos publicados" value="—" size="sm" tone="muted" />
      </div>

      {/* Estado (Part 9 — honesto, sem "em breve"). */}
      <Panel label="Estado do barramento">
        <div className="space-y-0">
          <StateRow label="Publisher" status="Nenhum publisher configurado" />
          <StateRow label="Subscribers" status="Nenhum subscriber ativo" />
          <StateRow label="Dispatcher" status="Arquitetura preparada" />
          <StateRow label="Fila / worker" status="Não implementado" />
        </div>
      </Panel>

      {/* Catálogo por categoria (Parts 3/4). */}
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

      {/* Event Log (Part 6) — modelo vazio elegante. */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Registro de eventos</p>
        <EmptyState
          icon={Radio}
          title="Nenhum evento publicado"
          description="Quando o dispatcher for ativado, cada evento aparece aqui: id, timestamp, origem, status (published · delivered · handled · failed · skipped), duração, payload hash, entidade, usuário, equipe e erro."
        />
      </div>
    </div>
  )
}
