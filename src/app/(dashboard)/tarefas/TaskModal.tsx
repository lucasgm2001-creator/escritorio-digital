'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Task, TaskPriority, LinkOption } from './types'

export interface TaskPrefill {
  title?: string
  due_date?: string
  due_time?: string
  priority?: TaskPriority
  link?: LinkOption | null
}

interface Props {
  onClose: () => void
  onSaved: (task: Task) => void
  currentUser: { id: string; name: string }
  linkOptions: LinkOption[]
  task?: Task | null            // presente = edição
  prefill?: TaskPrefill | null  // presente = criação pré-preenchida (ex: por IA)
  aiFilled?: boolean            // mostra o selo "preenchido por IA"
}

// Tokens bento, theme-aware. Foco em verde lima (acento estrutural do input).
const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

// Prioridade: normal = neutro (com seleção lime); alta/urgente = semântico sutil.
const PRIORITIES: { value: TaskPriority; label: string; on: string }[] = [
  { value: 'normal',  label: 'Normal',  on: 'text-bento-text bg-lime/10 border-lime/40' },
  { value: 'alta',    label: 'Alta',    on: 'text-amber-400 bg-amber-900/30 border-amber-800/50' },
  { value: 'urgente', label: 'Urgente', on: 'text-red-400 bg-red-900/30 border-red-800/50' },
]

// IMPORTANTE: Field em escopo de MÓDULO (não dentro do componente). Dentro do
// render seria recriado a cada keystroke → o input remonta e perde foco
// (o bug "só entra 1 letra" que já corrigimos 2x). Aqui o nó é estável.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-bento-dim mb-1">{label}</label>
      {children}
    </div>
  )
}

export function TaskModal({ onClose, onSaved, currentUser, linkOptions, task, prefill, aiFilled }: Props) {
  const editing = !!task
  const [title, setTitle]       = useState(task?.title ?? prefill?.title ?? '')
  const [notes, setNotes]       = useState(task?.notes ?? '')
  const [dueDate, setDueDate]   = useState(task?.due_date ?? prefill?.due_date ?? '')
  const [dueTime, setDueTime]   = useState((task?.due_time ?? prefill?.due_time ?? '').slice(0, 5))
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? prefill?.priority ?? 'normal')
  const [link, setLink]         = useState<LinkOption | null>(
    task?.linked_id && task?.linked_type
      ? linkOptions.find(o => o.id === task.linked_id)
        ?? { type: task.linked_type, id: task.linked_id, name: task.linked_name ?? 'Conectado' }
      : prefill?.link ?? null
  )
  const [linkQuery, setLinkQuery] = useState('')
  const [linkOpen, setLinkOpen]   = useState(false)
  const [saving, setSaving]       = useState(false)

  const supabase = createClient()

  const results = useMemo(() => {
    const q = linkQuery.trim().toLowerCase()
    if (!q) return []
    return linkOptions.filter(o => o.name.toLowerCase().includes(q)).slice(0, 8)
  }, [linkQuery, linkOptions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)

    const payload = {
      title: title.trim(),
      notes: notes.trim() || null,
      due_date: dueDate || null,
      due_time: dueDate && dueTime ? dueTime : null,   // hora só faz sentido com data
      priority,
      linked_type: link?.type ?? null,
      linked_id:   link?.id ?? null,
      linked_name: link?.name ?? null,
    }

    if (editing && task) {
      const { data, error } = await supabase
        .from('tasks').update(payload).eq('id', task.id).select().single()
      if (!error && data) { onSaved(data as Task); onClose() }
      else setSaving(false)
    } else {
      const { data, error } = await supabase
        .from('tasks').insert({ ...payload, user_id: currentUser.id, done: false }).select().single()
      if (!error && data) { onSaved(data as Task); onClose() }
      else setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-lg max-h-[92vh] flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bento-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-bento-text text-base">
              {editing ? 'Editar tarefa' : 'Nova tarefa'}
            </h2>
            {aiFilled && !editing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-lime/15 text-lime-fg">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                preenchido por IA
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-bento-muted hover:text-bento-text">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          <Field label="Tarefa *">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputCls}
              placeholder="Ex: Ligar para o Flávio sobre a proposta"
            />
          </Field>

          <Field label="Briefing / contexto">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Resumo da última conversa, pontos a tocar, links..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" value={dueDate}
                onChange={e => { const v = e.target.value; setDueDate(v); if (!v) setDueTime('') }}
                className={inputCls} />
            </Field>
            <Field label="Hora">
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                disabled={!dueDate}
                className={cn(inputCls, !dueDate && 'opacity-50 cursor-not-allowed')} />
            </Field>
          </div>

          <Field label="Prioridade">
            <div className="flex gap-1.5">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    'flex-1 py-2 rounded-btn text-xs font-semibold border transition-all',
                    priority === p.value ? p.on : 'text-bento-muted bg-bento-bg border-bento-border hover:border-lime',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Conectar a (lead ou cliente) */}
          <Field label="Conectar a (opcional)">
            {link ? (
              <div className="flex items-center justify-between gap-2 bg-bento-bg border border-bento-border rounded-btn px-3 py-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
                    link.type === 'lead' ? 'text-blue-400 bg-blue-900/30' : 'text-lime-fg bg-lime/15',
                  )}>
                    {link.type === 'lead' ? 'Lead' : 'Cliente'}
                  </span>
                  <span className="text-sm text-bento-text truncate">{link.name}</span>
                  {link.detail && <span className="text-xs text-bento-muted truncate">· {link.detail}</span>}
                </span>
                <button type="button" onClick={() => { setLink(null); setLinkQuery('') }}
                  className="text-bento-muted hover:text-bento-text shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={linkQuery}
                  onChange={e => { setLinkQuery(e.target.value); setLinkOpen(true) }}
                  onFocus={() => setLinkOpen(true)}
                  className={inputCls}
                  placeholder="Buscar lead ou cliente pelo nome..."
                />
                {linkOpen && results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-bento-panel border border-bento-border rounded-btn shadow-card-hover max-h-52 overflow-y-auto">
                    {results.map(o => (
                      <button
                        key={`${o.type}-${o.id}`}
                        type="button"
                        onClick={() => { setLink(o); setLinkOpen(false); setLinkQuery('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bento-bg transition-colors"
                      >
                        <span className={cn(
                          'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0',
                          o.type === 'lead' ? 'text-blue-400 bg-blue-900/30' : 'text-lime-fg bg-lime/15',
                        )}>
                          {o.type === 'lead' ? 'Lead' : 'Cliente'}
                        </span>
                        <span className="text-sm text-bento-text truncate">{o.name}</span>
                        {o.detail && <span className="text-xs text-bento-muted truncate">· {o.detail}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm hover:border-lime hover:text-bento-text transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !title.trim()}
              className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50">
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
