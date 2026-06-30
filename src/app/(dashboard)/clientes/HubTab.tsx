'use client'

import { useState, useMemo } from 'react'
import { Search, X, Plus, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { planLabel, healthOf, type Client, type Nicho, type ClientIntegration } from './types'

const ADD_COLORS = ['#38bdf8', '#fbbf24', '#C2F73A', '#22C55E', '#A855F7', '#EC4899', '#F97316', '#64748b']
const SEM_PRATELEIRA = '__sem__'
const TODOS = '__todos__'

export function HubTab({ clients, nichos, integrations, onOpen, onNichoCreated }: {
  clients: Client[]
  nichos: Nicho[]
  integrations: ClientIntegration[]
  onOpen: (id: string) => void
  onNichoCreated: (n: Nicho) => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())   // prateleiras abertas (todas FECHADAS no início)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(ADD_COLORS[0])
  const [busy, setBusy] = useState(false)

  const integByClient = useMemo(() => {
    const m = new Map<string, ClientIntegration>()
    integrations.forEach(i => m.set(i.client_id, i))
    return m
  }, [integrations])

  // Só clientes ATIVOS no Hub. Busca por nome / cidade / empresa.
  const q = search.trim().toLowerCase()
  const active = useMemo(() => {
    const list = clients.filter(c => c.status === 'ativo')
    if (!q) return list
    return list.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q),
    )
  }, [clients, q])

  // Prateleiras: "Todos" (virtual) + cada nicho ATIVO (por posicao) + "Sem prateleira" (se houver).
  const nichoNames = useMemo(() => new Set(nichos.map(n => n.nome)), [nichos])
  const shelves = useMemo(() => {
    const out: { key: string; nome: string; cor: string | null; items: Client[] }[] = []
    out.push({ key: TODOS, nome: 'Todos', cor: null, items: active })
    for (const n of [...nichos].filter(n => n.ativo).sort((a, b) => a.posicao - b.posicao)) {
      out.push({ key: n.id, nome: n.nome, cor: n.cor, items: active.filter(c => (c.nicho || '') === n.nome) })
    }
    const orphans = active.filter(c => !c.nicho || !nichoNames.has(c.nicho))
    if (orphans.length) out.push({ key: SEM_PRATELEIRA, nome: 'Sem prateleira', cor: null, items: orphans })
    return out
  }, [active, nichos, nichoNames])

  const searching = q !== ''
  const isOpen = (key: string, hasItems: boolean) => (searching ? hasItems : open.has(key))
  const toggle = (key: string) => setOpen(p => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n })

  const addNicho = async () => {
    const nome = newName.trim()
    if (!nome || busy) return
    if (nichoNames.has(nome)) { toast({ type: 'error', message: 'Já existe uma prateleira com esse nome.' }); return }
    setBusy(true)
    const posicao = Math.max(0, ...nichos.map(n => n.posicao)) + 1
    const { data, error } = await supabase.from('nichos').insert({ nome, cor: newColor, posicao, ativo: true }).select('*').single()
    setBusy(false)
    if (error || !data) { toast({ type: 'error', message: `Não foi possível criar: ${error?.message ?? 'erro'}` }); return }
    onNichoCreated(data as Nicho)
    setAdding(false); setNewName(''); setNewColor(ADD_COLORS[0])
    toast({ type: 'success', message: 'Prateleira criada.' })
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Busca + nova prateleira */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-bento-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, cidade ou empresa…"
            className="w-full bg-bento-bg border border-bento-border rounded-btn pl-9 pr-3 py-2.5 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-bento-muted hover:text-bento-text" aria-label="Limpar"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <button onClick={() => setAdding(a => !a)} className="bento-btn flex items-center gap-1.5 px-3 py-2.5 rounded-btn text-sm font-semibold shrink-0"><Plus className="w-4 h-4" />Nova prateleira</button>
      </div>

      {adding && (
        <div className="bento-fx p-3 flex items-center gap-3 flex-wrap">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addNicho(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Nome da prateleira (ex.: Construção)"
            className="flex-1 min-w-[180px] bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime" />
          <div className="flex items-center gap-1.5">
            {ADD_COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)} aria-label={c}
                className={cn('w-6 h-6 rounded-[5px] border-2 transition-transform', newColor === c ? 'border-bento-text scale-110' : 'border-transparent')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <button onClick={addNicho} disabled={busy || !newName.trim()} className="bento-btn px-3 py-2 rounded-btn text-sm font-semibold disabled:opacity-50">Adicionar</button>
          <button onClick={() => setAdding(false)} className="border border-bento-border text-bento-dim px-3 py-2 rounded-btn text-sm hover:border-lime transition-colors">Cancelar</button>
        </div>
      )}

      {/* Prateleiras */}
      <div className="space-y-3">
        {shelves.map(sh => {
          const opened = isOpen(sh.key, sh.items.length > 0)
          return (
            <div key={sh.key} className="bento-fx overflow-hidden">
              <button onClick={() => toggle(sh.key)} aria-expanded={opened}
                className="w-full flex items-center gap-2.5 px-4 py-3 min-h-[52px] text-left">
                <span className="w-3 h-3 rounded-[3px] flex-none" style={{ backgroundColor: sh.cor || '#64748b' }} />
                <span className="font-display font-bold text-bento-text text-sm flex-1 truncate">{sh.nome}</span>
                <span className="font-tech text-[11px] text-bento-muted tabular-nums">{sh.items.length}</span>
                {opened
                  ? <X className="w-4 h-4 text-bento-muted flex-none" />
                  : <span className="font-tech text-[10px] text-bento-muted flex-none">abrir</span>}
              </button>
              {opened && (
                <div className="px-3 pb-3 pt-1 border-t border-bento-border/60">
                  {sh.items.length === 0 ? (
                    <p className="text-center text-xs text-bento-muted/60 py-4 font-tech">Nenhum cliente aqui.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                      {sh.items.map(c => <ClientCard key={c.id} client={c} integ={integByClient.get(c.id)} onOpen={() => onOpen(c.id)} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ClientCard({ client, integ, onOpen }: { client: Client; integ?: ClientIntegration; onOpen: () => void }) {
  const health = healthOf(client.status)
  const waOn = !!integ?.ativo
  const cityLine = [client.city, client.company].filter(Boolean).join(' · ')
  return (
    <button onClick={onOpen}
      className="text-left bento-fx p-3.5 hover:border-lime/40 transition-colors flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-lg bg-lime/15 border border-lime/30 flex items-center justify-center flex-none">
          <span className="text-sm font-bold text-lime-fg">{(client.name || '?')[0]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-bento-text text-sm truncate">{client.name}</p>
          {cityLine && <p className="text-xs text-bento-muted truncate">{cityLine}</p>}
        </div>
        <span className={cn('w-2 h-2 rounded-full flex-none mt-1', health.dot)} title={health.label} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-tech text-[10px] font-semibold px-2 py-0.5 rounded-full border border-lime/40 text-lime-fg bg-lime/10">{planLabel(client.plan_weekly)}</span>
        <span className={cn('font-tech text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1',
          waOn ? 'border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10' : 'border-bento-border text-bento-muted bg-bento-bg')}>
          <MessageCircle className="w-3 h-3" />{waOn ? 'WhatsApp ativo' : 'WhatsApp off'}
        </span>
      </div>
    </button>
  )
}
