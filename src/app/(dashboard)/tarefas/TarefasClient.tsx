'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { TaskModal } from './TaskModal'
import type { Task, LinkOption } from './types'

interface Props {
  initialTasks: Task[]
  linkOptions: LinkOption[]
  currentUser: { id: string; name: string }
}

// ── Datas (local) ──
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isoPlus(days: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days)
  return toISO(d)
}
function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type SectionId = 'atrasadas' | 'hoje' | 'amanha' | 'semana' | 'depois'

const SECTIONS: { id: SectionId; label: string; danger?: boolean }[] = [
  { id: 'atrasadas', label: 'Atrasadas', danger: true },
  { id: 'hoje',      label: 'Hoje' },
  { id: 'amanha',    label: 'Amanhã' },
  { id: 'semana',    label: 'Esta semana' },
  { id: 'depois',    label: 'Depois / sem data' },
]

const PRIO_ORDER: Record<string, number> = { urgente: 3, alta: 2, normal: 1 }
const PRIORITY_TAG: Record<string, string> = {
  alta:    'text-amber-400 bg-amber-900/30',
  urgente: 'text-red-400 bg-red-900/30',
}

function sectionOf(t: Task, today: string, tomorrow: string, weekEnd: string): SectionId {
  if (!t.due_date) return 'depois'
  if (t.due_date < today)    return 'atrasadas'
  if (t.due_date === today)  return 'hoje'
  if (t.due_date === tomorrow) return 'amanha'
  if (t.due_date <= weekEnd) return 'semana'
  return 'depois'
}

function sortPending(a: Task, b: Task): number {
  // 1) prioridade (urgente → normal)
  const p = (PRIO_ORDER[b.priority] ?? 1) - (PRIO_ORDER[a.priority] ?? 1)
  if (p) return p
  // 2) dia (relevante em seções multi-dia: Atrasadas/Esta semana/Depois)
  const da = a.due_date ?? '9999-99-99'
  const db = b.due_date ?? '9999-99-99'
  if (da !== db) return da < db ? -1 : 1
  // 3) dentro do dia: com hora (por horário) antes de sem hora ('~' > dígitos)
  const ta = a.due_time ? a.due_time.slice(0, 5) : '~'
  const tb = b.due_time ? b.due_time.slice(0, 5) : '~'
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.created_at < b.created_at ? -1 : 1
}

export function TarefasClient({ initialTasks, linkOptions, currentUser }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const supabase = createClient()
  const phoneById = useMemo(() => {
    const m = new Map<string, string>()
    linkOptions.forEach(o => { if (o.phone) m.set(o.id, o.phone) })
    return m
  }, [linkOptions])

  const today = toISO(new Date()), tomorrow = isoPlus(1), weekEnd = isoPlus(7)

  const { groups, done } = useMemo(() => {
    const groups: Record<SectionId, Task[]> = { atrasadas: [], hoje: [], amanha: [], semana: [], depois: [] }
    const done: Task[] = []
    for (const t of tasks) {
      if (t.done) done.push(t)
      else groups[sectionOf(t, today, tomorrow, weekEnd)].push(t)
    }
    ;(Object.keys(groups) as SectionId[]).forEach(k => groups[k].sort(sortPending))
    done.sort((a, b) => (b.completed_at ?? b.updated_at) < (a.completed_at ?? a.updated_at) ? -1 : 1)
    return { groups, done }
  }, [tasks, today, tomorrow, weekEnd])

  const pendingCount = tasks.filter(t => !t.done).length

  // ── Ações ──
  const toggleDone = (t: Task) => {
    const nowDone = !t.done
    const completed_at = nowDone ? new Date().toISOString() : null
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: nowDone, completed_at } : x))
    supabase.from('tasks').update({ done: nowDone, completed_at }).eq('id', t.id)
  }
  const handleSaved = (t: Task) => {
    setTasks(prev => prev.some(x => x.id === t.id) ? prev.map(x => x.id === t.id ? t : x) : [t, ...prev])
  }
  const handleDelete = (t: Task) => {
    setTasks(prev => prev.filter(x => x.id !== t.id))
    setConfirmId(null)
    supabase.from('tasks').delete().eq('id', t.id)
  }
  const openNew  = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (t: Task) => { setEditing(t); setModalOpen(true) }

  // ── Linha de tarefa (função inline → sem componente aninhado, sem bug de foco) ──
  const renderRow = (t: Task) => {
    const phone = t.linked_id ? phoneById.get(t.linked_id) : undefined
    const isExpanded = expandedId === t.id
    const isConfirming = confirmId === t.id

    return (
      <div key={t.id} className="group bento-fx p-3">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={() => toggleDone(t)}
            aria-label={t.done ? 'Desmarcar' : 'Marcar como feita'}
            className={cn(
              'mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center flex-none transition-colors',
              t.done ? 'bg-lime border-lime' : 'border-bento-border hover:border-lime',
            )}
          >
            {t.done && (
              <svg className="w-3 h-3 text-lime-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Conteúdo */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm leading-snug', t.done ? 'line-through text-bento-muted' : 'text-bento-text')}>
                {t.title}
              </span>
              {!t.done && t.priority !== 'normal' && (
                <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded', PRIORITY_TAG[t.priority])}>
                  {t.priority}
                </span>
              )}
            </div>

            {/* Chip de lead/cliente + telefone */}
            {t.linked_id && t.linked_name && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Link
                  href={t.linked_type === 'lead' ? '/comercial' : '/clientes'}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-bento-bg border border-bento-border text-bento-dim hover:border-lime transition-colors max-w-[200px]"
                >
                  <span className={cn('w-1 h-1 rounded-full flex-none', t.linked_type === 'lead' ? 'bg-blue-400' : 'bg-lime')} />
                  <span className="truncate">{t.linked_name}</span>
                </Link>
                {phone && (
                  <a href={`tel:${phone}`} aria-label={`Ligar para ${t.linked_name}`}
                    className="inline-flex items-center justify-center w-5 h-5 rounded text-bento-muted hover:text-lime-fg transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            {/* Briefing expandido */}
            {isExpanded && t.notes && (
              <p className="mt-2 text-xs text-bento-dim whitespace-pre-wrap bg-bento-bg border border-bento-border rounded-btn p-2.5">
                {t.notes}
              </p>
            )}
          </div>

          {/* Lado direito: data + ações */}
          <div className="flex items-center gap-1.5 flex-none">
            {t.notes && (
              <button
                onClick={() => setExpandedId(isExpanded ? null : t.id)}
                aria-label="Ver briefing"
                className={cn('w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                  isExpanded ? 'text-lime-fg' : 'text-bento-muted hover:text-bento-text')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
                </svg>
              </button>
            )}

            {t.due_date && !t.done && (
              <span className="font-tech text-[10px] text-bento-muted tabular-nums">
                {fmtDate(t.due_date)}{t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ''}
              </span>
            )}

            {isConfirming ? (
              <span className="flex items-center gap-1">
                <button onClick={() => handleDelete(t)} className="text-[10px] font-semibold text-red-400 px-1.5 py-0.5 rounded bg-red-900/30 hover:bg-red-900/50 transition-colors">Excluir</button>
                <button onClick={() => setConfirmId(null)} className="text-[10px] text-bento-muted px-1 hover:text-bento-text">não</button>
              </span>
            ) : (
              <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(t)} aria-label="Editar"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-bento-muted hover:text-bento-text transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => setConfirmId(t.id)} aria-label="Excluir"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-bento-muted hover:text-red-400 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  const totalTasks = tasks.length

  return (
    <div className="h-full overflow-auto bg-bento-bg font-body">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 sm:px-6 pt-5 pb-3 sticky top-0 bg-bento-bg/95 backdrop-blur z-10 border-b border-bento-border">
        <div className="flex items-center gap-3">
          <h1 className="font-display font-bold text-bento-text text-lg tracking-tight">Tarefas</h1>
          <span className="font-tech text-xs text-bento-muted tabular-nums">{pendingCount} pendentes</span>
        </div>
        <button onClick={openNew}
          className="bento-btn flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold w-full sm:w-auto">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova tarefa
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        {totalTasks === 0 ? (
          <EmptyAll onNew={openNew} />
        ) : (
          <>
            {SECTIONS.map(sec => {
              const items = groups[sec.id]
              if (items.length === 0 && sec.id !== 'hoje') return null
              return (
                <section key={sec.id}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <h2 className={cn('text-xs font-semibold uppercase tracking-wide',
                      sec.danger ? 'text-red-400' : 'text-bento-dim')}>
                      {sec.label}
                    </h2>
                    {items.length > 0 && (
                      <span className="font-tech text-[10px] text-bento-muted tabular-nums">{items.length}</span>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <EmptyToday />
                  ) : (
                    <div className="space-y-2">{items.map(renderRow)}</div>
                  )}
                </section>
              )
            })}

            {/* Concluídas (recolhível) */}
            {done.length > 0 && (
              <section>
                <button onClick={() => setShowDone(v => !v)}
                  className="flex items-center gap-2 mb-2 px-1 text-bento-dim hover:text-bento-text transition-colors">
                  <svg className={cn('w-3.5 h-3.5 transition-transform', showDone && 'rotate-90')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-wide">Concluídas</span>
                  <span className="font-tech text-[10px] text-bento-muted tabular-nums">{done.length}</span>
                </button>
                {showDone && (
                  <div className="space-y-2">{done.slice(0, 30).map(renderRow)}</div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <TaskModal
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          currentUser={currentUser}
          linkOptions={linkOptions}
          task={editing}
        />
      )}
    </div>
  )
}

// ── Estados vazios ──
function EmptyToday() {
  return (
    <div className="bento-fx p-6 flex flex-col items-center justify-center text-center">
      <svg className="w-8 h-8 text-bento-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-bento-dim">Nenhuma tarefa pra hoje</p>
      <p className="text-xs text-bento-muted mt-0.5">Aproveite — ou puxe algo de outro dia.</p>
    </div>
  )
}

function EmptyAll({ onNew }: { onNew: () => void }) {
  return (
    <div className="bento-fx p-10 flex flex-col items-center justify-center text-center mt-6">
      <div className="w-14 h-14 rounded-2xl bg-lime/10 border border-lime/30 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-lime-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      </div>
      <p className="text-base font-semibold text-bento-text">Nenhuma tarefa ainda</p>
      <p className="text-sm text-bento-muted mt-1 max-w-xs">Crie sua primeira tarefa — solta ou conectada a um lead/cliente.</p>
      <button onClick={onNew} className="bento-btn mt-5 px-5 py-2.5 rounded-btn text-sm font-semibold">
        Nova tarefa
      </button>
    </div>
  )
}
