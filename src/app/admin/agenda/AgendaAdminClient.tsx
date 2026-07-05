'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCollaboratorAgendaAction } from './actions'
import { EVENT_TYPE_LABELS, type CalendarEvent } from '@/app/(dashboard)/hall/calendarShared'

type Collab = { userId: string; name: string; roleName: string | null; avatarUrl: string | null }

// Agenda administrativa (Parte 6) — só LEITURA. Lista os colaboradores; ao selecionar, carrega os eventos
// daquele colaborador (getCollaboratorAgendaAction) e os mostra agrupados por data. REUSA calendar_events e o
// tipo CalendarEvent do Hall — nenhum calendário novo. O gate (owner/dev) está no layout do /admin + na action.
export function AgendaAdminClient({ collaborators }: { collaborators: Collab[] }) {
  const [selected, setSelected] = useState<Collab | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = async (c: Collab) => {
    setSelected(c); setLoading(true); setError(null); setEvents([])
    const r = await getCollaboratorAgendaAction(c.userId)
    setLoading(false)
    if (r.ok) setEvents(r.events); else setError(r.error)
  }

  const byDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => { (acc[e.date] ??= []).push(e); return acc }, {})
  const dates = Object.keys(byDate).sort()
  const fmtDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}` }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-bold text-bento-text text-lg flex items-center gap-2"><CalendarDays className="w-5 h-5 text-lime-fg" /> Agendas</h1>
        <p className="text-[13px] text-bento-muted mt-0.5">Veja a agenda de cada colaborador (só leitura). Reusa o calendário existente — nenhum calendário novo.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,280px)_1fr] gap-4 items-start">
        <div className="space-y-1.5">
          {collaborators.length === 0 ? <p className="text-[13px] text-bento-muted">Nenhum colaborador.</p> : collaborators.map(c => (
            <button key={c.userId} onClick={() => open(c)}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-btn border text-left transition-colors', selected?.userId === c.userId ? 'border-lime/40 bg-lime/10' : 'border-bento-border bg-bento-panel hover:border-lime/40')}>
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-bento-bg border border-bento-border text-xs font-bold text-bento-dim shrink-0">{c.name[0]?.toUpperCase() ?? 'U'}</span>
              <span className="min-w-0">
                <span className="block text-sm text-bento-text truncate">{c.name}</span>
                <span className="block text-[11px] text-bento-muted truncate">{c.roleName ?? '—'}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="bento-fx p-4 min-h-[240px]">
          {!selected ? <p className="text-[13px] text-bento-muted">Selecione um colaborador para ver a agenda.</p>
            : loading ? <p className="text-[13px] text-bento-muted">Carregando…</p>
            : error ? <p className="text-[13px] text-red-400">{error}</p>
            : dates.length === 0 ? <p className="text-[13px] text-bento-muted">{selected.name} não tem compromissos na agenda.</p>
            : (
              <div className="space-y-4">
                <p className="font-display font-semibold text-bento-text text-sm">Agenda de {selected.name}</p>
                {dates.map(d => (
                  <div key={d}>
                    <p className="font-tech text-[11px] uppercase tracking-wide text-bento-muted mb-1.5">{fmtDate(d)}</p>
                    <div className="space-y-1">
                      {byDate[d].slice().sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')).map(e => (
                        <div key={e.id} className="flex items-center gap-2 bg-bento-bg border border-bento-border rounded-btn px-3 py-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                          <span className="text-sm text-bento-text truncate flex-1">{e.title}</span>
                          <span className="font-tech text-[10px] text-bento-muted shrink-0">{EVENT_TYPE_LABELS[e.type] ?? e.type}{e.start_time ? ` · ${e.start_time}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
