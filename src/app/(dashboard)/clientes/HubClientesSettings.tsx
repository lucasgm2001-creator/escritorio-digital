'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronUp, ChevronDown, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Panel } from '@/components/bento/Panel'
import { cn } from '@/lib/utils'
import type { Nicho } from './types'

const COLORS = ['#38bdf8', '#fbbf24', '#C2F73A', '#22C55E', '#10B981', '#A855F7', '#EC4899', '#F97316', '#EF4444', '#64748b']

// Gestão das prateleiras (tabela `nichos`): criar / renomear / cor / ordem / ativar-desativar.
export function HubClientesSettings() {
  const supabase = createClient()
  const { toast } = useToast()
  const [nichos, setNichos] = useState<Nicho[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})   // rename por id (rascunho do input)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('nichos').select('*').order('posicao')
    const list = (data ?? []) as Nicho[]
    setNichos(list)
    setDraft(Object.fromEntries(list.map(n => [n.id, n.nome])))
    setLoading(false)
  }, [supabase])
  useEffect(() => { load() }, [load])

  const patch = async (id: string, p: Partial<Nicho>) => {
    setBusy(true)
    setNichos(prev => prev.map(n => n.id === id ? { ...n, ...p } : n))
    const { error } = await supabase.from('nichos').update(p).eq('id', id)
    setBusy(false)
    if (error) { toast({ type: 'error', message: `Não foi possível salvar: ${error.message}` }); load() }
  }

  const rename = async (n: Nicho) => {
    const nn = (draft[n.id] ?? '').trim()
    if (!nn || nn === n.nome) { setDraft(d => ({ ...d, [n.id]: n.nome })); return }
    if (nichos.some(x => x.id !== n.id && x.nome === nn)) { toast({ type: 'error', message: 'Já existe uma prateleira com esse nome.' }); setDraft(d => ({ ...d, [n.id]: n.nome })); return }
    await patch(n.id, { nome: nn })
    // NOTA: renomear o nicho NÃO move os clientes (clients.nicho guarda o nome antigo) — avisamos.
    toast({ type: 'success', message: 'Renomeada. Clientes já vinculados pelo nome antigo não migram automaticamente.' })
  }

  // Trocar a ordem com o vizinho (swap de posicao).
  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= nichos.length || busy) return
    const a = nichos[idx], b = nichos[j]
    setBusy(true)
    setNichos(prev => { const c = [...prev];[c[idx], c[j]] = [c[j], c[idx]]; return c })
    const r = await Promise.all([
      supabase.from('nichos').update({ posicao: b.posicao }).eq('id', a.id),
      supabase.from('nichos').update({ posicao: a.posicao }).eq('id', b.id),
    ])
    setBusy(false)
    if (r.some(x => x.error)) { toast({ type: 'error', message: 'Falha ao reordenar.' }); load() }
  }

  const add = async () => {
    const nome = newName.trim()
    if (!nome || busy) return
    if (nichos.some(n => n.nome === nome)) { toast({ type: 'error', message: 'Já existe.' }); return }
    setBusy(true)
    const posicao = Math.max(0, ...nichos.map(n => n.posicao)) + 1
    const { error } = await supabase.from('nichos').insert({ nome, cor: COLORS[nichos.length % COLORS.length], posicao, ativo: true })
    setBusy(false)
    if (error) { toast({ type: 'error', message: `Não foi possível criar: ${error.message}` }); return }
    setNewName(''); setAdding(false); load()
  }

  return (
    <Panel label="Hub de Clientes">
      <div className="space-y-3">
        <p className="font-tech text-[11px] text-bento-muted">Prateleiras (nichos) do Hub. A prateleira de um cliente é o campo <span className="text-bento-text">nicho</span> dele.</p>

        {loading ? <p className="text-sm text-bento-muted">Carregando...</p> : (
          <div className="space-y-2">
            {nichos.map((n, i) => (
              <div key={n.id} className="bento-fx p-2.5 flex items-center gap-2 flex-wrap">
                <span className="w-3 h-3 rounded-[3px] flex-none" style={{ backgroundColor: n.cor || '#64748b' }} />
                <input value={draft[n.id] ?? n.nome} onChange={e => setDraft(d => ({ ...d, [n.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  onBlur={() => rename(n)}
                  className="flex-1 min-w-[120px] bg-bento-bg border border-bento-border rounded-btn px-2.5 py-1.5 text-sm text-bento-text focus:outline-none focus:border-lime" />
                <div className="flex items-center gap-1">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => patch(n.id, { cor: c })} aria-label={c}
                      className={cn('w-5 h-5 rounded-[4px] border-2 transition-transform', (n.cor ?? '').toUpperCase() === c ? 'border-bento-text scale-110' : 'border-transparent hover:scale-105')}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button onClick={() => patch(n.id, { ativo: !n.ativo })} aria-pressed={n.ativo} aria-label="Ativar/desativar"
                  className={cn('relative w-10 h-6 rounded-full transition-colors flex-none', n.ativo ? 'bg-lime' : 'bg-bento-border')}>
                  <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', n.ativo && 'translate-x-4')} />
                </button>
                <div className="flex items-center">
                  <button onClick={() => move(i, -1)} disabled={i === 0 || busy} className="p-1 text-bento-muted hover:text-bento-text disabled:opacity-30" aria-label="Subir"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === nichos.length - 1 || busy} className="p-1 text-bento-muted hover:text-bento-text disabled:opacity-30" aria-label="Descer"><ChevronDown className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div className="bento-fx p-2.5 flex items-center gap-2">
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="Nome da prateleira" className="flex-1 bg-bento-bg border border-bento-border rounded-btn px-2.5 py-1.5 text-sm text-bento-text focus:outline-none focus:border-lime" />
            <button onClick={add} disabled={busy || !newName.trim()} className="bento-btn px-3 py-1.5 rounded-btn text-xs font-semibold disabled:opacity-50">Adicionar</button>
            <button onClick={() => setAdding(false)} className="border border-bento-border text-bento-dim px-3 py-1.5 rounded-btn text-xs hover:border-lime transition-colors">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-1.5 border border-dashed border-bento-border rounded-md py-2 text-xs text-bento-muted hover:border-lime hover:text-lime-fg transition-colors"><Plus className="w-3.5 h-3.5" />Nova prateleira</button>
        )}
      </div>
    </Panel>
  )
}
