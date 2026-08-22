'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import type { EntityObservation, ObservationEntityType } from '@/lib/observations/types'
import { addEntityObservationAction, listEntityObservationsAction } from '@/app/(dashboard)/observations-actions'
import { cn } from '@/lib/utils'

// Box de OBSERVAÇÕES sempre visível (OBS-BOX-001). Antes o histórico só existia na página dedicada
// /comercial/lead/[id]/observacoes — ou seja, só quem lembrava de navegar até lá via o que já tinha sido
// anotado. Agora a mesma caixa aparece no perfil do lead (funil) e na Minha Mesa, ao lado da tarefa.
//
// Duas formas de alimentar, sem duplicar componente:
//  • `initialItems` — a página já leu no servidor (lead do funil): renderiza na primeira pintura, sem flash.
//  • sem `initialItems` — carrega sozinha pela action (Minha Mesa, onde a entidade muda conforme a seleção).
// Escrever reusa addEntityObservationAction, a MESMA da página dedicada: no lead a nota nasce em
// lead_interactions e o gatilho a transforma em observação permanente, então Timeline e histórico não brigam.

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function ObservationsBox({ entityType, entityId, initialItems, title = 'Observações', maxHeight = 'max-h-64' }: {
  entityType: ObservationEntityType
  entityId: string
  initialItems?: EntityObservation[]
  title?: string
  maxHeight?: string
}) {
  const [items, setItems] = useState<EntityObservation[]>(initialItems ?? [])
  const [loading, setLoading] = useState(initialItems === undefined)
  const [body, setBody] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const reload = useCallback(async () => {
    const res = await listEntityObservationsAction(entityType, entityId)
    if (res.ok) setItems(res.items)
    else setError(res.error)
    setLoading(false)
  }, [entityType, entityId])

  // Só busca quando a página NÃO entregou os itens. Refaz ao trocar de entidade (na Mesa, mudar de tarefa
  // troca o lead sob o mesmo componente montado) — por isso o efeito depende de entityId, não de []
  useEffect(() => {
    if (initialItems !== undefined) { setItems(initialItems); setLoading(false); return }
    setLoading(true)
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  function add() {
    const clean = body.trim()
    if (!clean || pending) return
    setError(null)
    startTransition(async () => {
      const result = await addEntityObservationAction(entityType, entityId, clean)
      if (!result.ok) { setError(result.error); return }
      setBody('')
      setOpen(false)
      await reload()
    })
  }

  return (
    <div className="rounded-bento border border-bento-border bg-bento-bg/50 p-3 min-w-0">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-3.5 h-3.5 text-bento-muted shrink-0" aria-hidden />
        <p className="font-tech text-[10px] uppercase tracking-label text-bento-muted flex-1 min-w-0">{title}</p>
        <span className="font-tech text-[10px] text-bento-dim shrink-0">{items.length}</span>
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-btn border border-bento-border px-2 py-1 text-[10px] text-bento-muted hover:border-lime hover:text-lime-fg transition-colors">
          <Plus className="w-3 h-3" aria-hidden /> Anotar
        </button>
      </div>

      {open && (
        <div className="mt-2.5 space-y-2">
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} autoFocus
            placeholder="O que precisa ficar registrado sobre este lead?"
            className="w-full bg-bento-bg border border-bento-border rounded-btn px-2.5 py-2 text-xs text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime resize-none" />
          <div className="flex gap-2">
            <button type="button" onClick={add} disabled={pending || !body.trim()}
              className="bento-btn px-3 min-h-[34px] rounded-btn text-xs font-semibold disabled:opacity-50">
              {pending ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setBody(''); setError(null) }}
              className="px-3 min-h-[34px] rounded-btn border border-bento-border text-xs text-bento-muted hover:text-bento-text">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

      <div className={cn('mt-2.5 space-y-2 overflow-y-auto overscroll-contain', maxHeight)}>
        {loading ? (
          <p className="text-[11px] text-bento-muted">Carregando observações…</p>
        ) : items.length === 0 ? (
          <p className="text-[11px] text-bento-muted">Nenhuma observação registrada ainda.</p>
        ) : items.map(item => (
          <div key={item.id} className="border-b border-bento-border/40 pb-2 last:border-0 last:pb-0 min-w-0">
            <p className="text-xs text-bento-dim whitespace-pre-wrap break-words">{item.body}</p>
            <p className="font-tech text-[9px] text-bento-muted mt-1">
              {fmtDate(item.createdAt)} · {item.authorName || 'Sistema'}
              {item.sourceLabel ? ` · ${item.sourceLabel}` : ''}
              {item.editedAt ? ' · editada' : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
