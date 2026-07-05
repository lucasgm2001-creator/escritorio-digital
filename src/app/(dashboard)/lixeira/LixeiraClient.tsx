'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trash2, RotateCcw } from 'lucide-react'
import { useRole } from '@/components/auth/RoleProvider'
import { useToast } from '@/components/ui/toast'
import { listTrashAction, restoreClientAction, restoreLeadAction, hardDeleteClientAction, hardDeleteLeadAction, type TrashRow } from './actions'

export function LixeiraClient() {
  const role = useRole()
  const { toast } = useToast()
  const [clients, setClients] = useState<TrashRow[]>([])
  const [leads, setLeads] = useState<TrashRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await listTrashAction()
    if (r.ok) { setClients(r.clients); setLeads(r.leads) } else toast({ type: 'error', message: r.error })
    setLoading(false)
  }, [toast])
  useEffect(() => { if (role === 'owner') load(); else setLoading(false) }, [role, load])

  if (role !== 'owner') return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <p className="text-sm text-bento-muted">A Lixeira é restrita ao <span className="text-bento-text font-medium">owner</span> da equipe.</p>
    </div>
  )

  const act = async (kind: 'restore' | 'hard', type: 'client' | 'lead', id: string, name: string) => {
    if (kind === 'hard' && !confirm(`Excluir DEFINITIVAMENTE "${name}"? Apaga fisicamente do banco — não dá para desfazer.`)) return
    setBusy(id)
    const fn = kind === 'restore'
      ? (type === 'client' ? restoreClientAction : restoreLeadAction)
      : (type === 'client' ? hardDeleteClientAction : hardDeleteLeadAction)
    const r = await fn(id)
    setBusy(null)
    if (!r.ok) { toast({ type: 'error', message: r.error }); return }
    toast({ type: 'success', message: kind === 'restore' ? `${name} restaurado.` : `${name} excluído definitivamente.` })
    await load()
  }

  const Section = ({ title, rows, type }: { title: string; rows: TrashRow[]; type: 'client' | 'lead' }) => (
    <div className="space-y-2">
      <h2 className="font-display font-bold text-bento-text text-sm">{title} <span className="font-tech text-[11px] text-bento-muted">({rows.length})</span></h2>
      {rows.length === 0 ? <p className="text-[13px] text-bento-muted">Nada na lixeira.</p> : rows.map(r => (
        <div key={r.id} className="flex items-center gap-2 bg-bento-panel border border-bento-border rounded-btn px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-bento-text truncate">{r.name}</p>
            <p className="font-tech text-[10px] text-bento-muted truncate">{r.company ?? '—'} · excluído {new Date(r.deletedAt).toLocaleDateString('pt-BR')}</p>
          </div>
          <button onClick={() => act('restore', type, r.id, r.name)} disabled={busy === r.id}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-btn text-xs border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50 shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar
          </button>
          <button onClick={() => act('hard', type, r.id, r.name)} disabled={busy === r.id}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-btn text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0">
            <Trash2 className="w-3.5 h-3.5" /> Definitivo
          </button>
        </div>
      ))}
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6 space-y-6">
      <header>
        <h1 className="font-display font-bold text-bento-text text-lg">Lixeira</h1>
        <p className="text-[13px] text-bento-muted mt-0.5">Clientes e leads excluídos (soft delete). Restaurar traz tudo de volta; “Definitivo” apaga fisicamente. Só o owner.</p>
      </header>
      {loading ? <p className="text-sm text-bento-muted">Carregando...</p> : (<>
        <Section title="Clientes" rows={clients} type="client" />
        <Section title="Leads" rows={leads} type="lead" />
      </>)}
    </div>
  )
}
