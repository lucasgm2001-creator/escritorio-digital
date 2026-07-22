'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ClipboardList, Clock3, Pencil, Plus, X } from 'lucide-react'
import type { EntityObservation, ObservationEntityType } from '@/lib/observations/types'
import { addEntityObservationAction, updateEntityObservationAction } from '@/app/(dashboard)/observations-actions'

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manual',
  task: 'Tarefa',
  lead_interaction: 'Interação comercial',
  client_payment: 'Financeiro',
  plan_change: 'Plano',
}

function fmtDate(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function initials(name: string | null): string {
  return name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '·'
}

export function ObservationWorkspace({ entityType, entityId, items }: {
  entityType: ObservationEntityType
  entityId: string
  items: EntityObservation[]
}) {
  const router = useRouter()
  const [newBody, setNewBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function add() {
    if (!newBody.trim() || pending) return
    setError(null)
    startTransition(async () => {
      const result = await addEntityObservationAction(entityType, entityId, newBody)
      if (!result.ok) { setError(result.error); return }
      setNewBody('')
      router.refresh()
    })
  }

  function save(id: string) {
    if (!draft.trim() || pending) return
    setError(null)
    startTransition(async () => {
      const result = await updateEntityObservationAction(id, draft)
      if (!result.ok) { setError(result.error); return }
      setEditingId(null)
      setDraft('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-bento border border-bento-border bg-bento-panel/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="h-4 w-4 text-lime-fg" />
          <h2 className="text-sm font-semibold text-bento-text">Nova observação</h2>
        </div>
        <textarea
          value={newBody}
          onChange={event => setNewBody(event.target.value)}
          rows={3}
          maxLength={10_000}
          placeholder="Registre contexto, objeções, combinados ou qualquer evolução importante…"
          className="w-full resize-y rounded-btn border border-bento-border bg-bento-bg px-3 py-2.5 text-sm text-bento-text placeholder:text-bento-muted focus:border-lime/60 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-bento-muted">Este registro permanece mesmo se a tarefa de origem for excluída.</p>
          <button type="button" onClick={add} disabled={pending || !newBody.trim()}
            className="bento-btn min-h-[40px] shrink-0 rounded-btn px-4 text-sm font-semibold disabled:opacity-50">
            {pending ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </section>

      {error && <p className="rounded-btn border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

      <section className="space-y-3" aria-label="Evolução das observações">
        {items.length === 0 ? (
          <div className="rounded-bento border border-dashed border-bento-border p-8 text-center">
            <ClipboardList className="mx-auto h-7 w-7 text-bento-muted" />
            <p className="mt-2 text-sm text-bento-muted">Nenhuma observação registrada ainda.</p>
          </div>
        ) : items.map(item => {
          const editing = editingId === item.id
          return (
            <article key={item.id} className="rounded-bento border border-bento-border bg-bento-panel/45 p-4">
              {editing ? (
                <div className="space-y-2">
                  <textarea value={draft} onChange={event => setDraft(event.target.value)} rows={4} maxLength={10_000}
                    className="w-full resize-y rounded-btn border border-lime/40 bg-bento-bg px-3 py-2.5 text-sm text-bento-text focus:outline-none" />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setEditingId(null); setDraft('') }} className="inline-flex min-h-[38px] items-center gap-1.5 rounded-btn border border-bento-border px-3 text-xs text-bento-muted">
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </button>
                    <button type="button" onClick={() => save(item.id)} disabled={pending || !draft.trim()} className="bento-btn inline-flex min-h-[38px] items-center gap-1.5 rounded-btn px-3 text-xs font-semibold disabled:opacity-50">
                      <Check className="h-3.5 w-3.5" /> Salvar edição
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-lime/20 bg-lime/10 text-[11px] font-bold text-lime-fg">
                      {initials(item.authorName)}
                    </span>
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-bento-text">{item.body}</p>
                    <button type="button" title="Editar observação" aria-label="Editar observação"
                      onClick={() => { setEditingId(item.id); setDraft(item.body); setError(null) }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-bento-muted hover:bg-bento-bg hover:text-bento-text">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <footer className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-bento-border/60 pt-2.5 text-[11px] text-bento-muted">
                    <span>{item.authorName ?? 'Sistema'}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {fmtDate(item.createdAt)}</span>
                    <span className="rounded-full border border-bento-border px-1.5 py-0.5 font-tech uppercase tracking-wide">
                      {SOURCE_LABEL[item.sourceType] ?? item.sourceType.replaceAll('_', ' ')}
                    </span>
                    {item.sourceLabel && <span className="min-w-0 break-words text-bento-dim">{item.sourceLabel}</span>}
                    {item.editedAt && <span className="text-bento-dim">· editada em {fmtDate(item.editedAt)}</span>}
                  </footer>
                </>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}
