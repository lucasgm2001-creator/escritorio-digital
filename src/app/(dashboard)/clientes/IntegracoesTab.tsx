'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, X, Plus, MessageCircle } from 'lucide-react'
import { upsertClientIntegrationAction } from './client-write-actions'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { Client, ClientIntegration } from './types'

export function IntegracoesTab({ clients, integrations, onChange }: {
  clients: Client[]
  integrations: ClientIntegration[]
  onChange: (i: ClientIntegration) => void
}) {
  const { toast } = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const integByClient = useMemo(() => {
    const m = new Map<string, ClientIntegration>()
    integrations.forEach(i => m.set(i.client_id, i))
    return m
  }, [integrations])

  // Foco em House Cleaning: ativos primeiro, House Cleaning no topo.
  const list = useMemo(() => {
    return clients.filter(c => c.status === 'ativo').sort((a, b) => {
      const ah = (a.nicho === 'House Cleaning') ? 0 : 1
      const bh = (b.nicho === 'House Cleaning') ? 0 : 1
      return ah - bh || (a.name || '').localeCompare(b.name || '')
    })
  }, [clients])

  // UPSERT (1 linha por cliente, UNIQUE client_id). Ligar cria a linha se não existir.
  const upsert = async (clientId: string, patch: Partial<ClientIntegration>) => {
    setBusyId(clientId)
    const cur = integByClient.get(clientId)
    const row = {
      client_id: clientId,
      ativo: cur?.ativo ?? false,
      instancia: cur?.instancia ?? null,
      numero_destino: cur?.numero_destino ?? null,
      template: cur?.template ?? null,
      landing_pages: cur?.landing_pages ?? [],
      ...patch,
      updated_at: new Date().toISOString(),
    }
    const res = await upsertClientIntegrationAction(row)
    setBusyId(null)
    if (!res.ok) { toast({ type: 'error', message: `Não foi possível salvar: ${res.error}` }); return false }
    onChange(res.integration as unknown as ClientIntegration)
    return true
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h2 className="font-display font-bold text-bento-text text-base">Integrações</h2>
        <p className="text-bento-muted text-xs mt-0.5">Central da automação de WhatsApp (Z-API). Automação focada em <span className="text-bento-text">House Cleaning</span>.</p>
      </div>

      <div className="space-y-2">
        {list.map(c => {
          const integ = integByClient.get(c.id)
          const on = !!integ?.ativo
          const expanded = openId === c.id
          const sub = [c.city, c.nicho].filter(Boolean).join(' · ')
          return (
            <div key={c.id} className="bento-fx overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-bento-text text-sm truncate">{c.name}</p>
                  {sub && <p className="font-tech text-[11px] text-bento-muted truncate">{sub}</p>}
                </div>
                <span className={cn('font-tech text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 shrink-0',
                  on ? 'border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10' : 'border-bento-border text-bento-muted bg-bento-bg')}>
                  <MessageCircle className="w-3 h-3" />{on ? 'Ativa' : 'Inativa'}
                </span>
                {/* Toggle liga/desliga (faz upsert). */}
                <button onClick={() => upsert(c.id, { ativo: !on })} disabled={busyId === c.id} aria-pressed={on} aria-label="Ligar/desligar automação"
                  className={cn('relative w-10 h-6 rounded-full transition-colors flex-none disabled:opacity-50', on ? 'bg-lime' : 'bg-bento-border')}>
                  <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', on && 'translate-x-4')} />
                </button>
                <button onClick={() => setOpenId(p => p === c.id ? null : c.id)} className="p-1 text-bento-muted hover:text-bento-text flex-none" aria-label="Configurar">
                  <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
                </button>
              </div>
              {expanded && (
                <ConfigForm key={c.id} integ={integ} busy={busyId === c.id} onSave={(patch) => upsert(c.id, patch)} />
              )}
            </div>
          )
        })}
        {list.length === 0 && <p className="text-sm text-bento-muted text-center py-8 font-tech">Nenhum cliente ativo.</p>}
      </div>
    </div>
  )
}

function ConfigForm({ integ, busy, onSave }: { integ?: ClientIntegration; busy: boolean; onSave: (patch: Partial<ClientIntegration>) => Promise<boolean> }) {
  const [instancia, setInstancia] = useState(integ?.instancia ?? '')
  const [numero, setNumero] = useState(integ?.numero_destino ?? '')
  const [template, setTemplate] = useState(integ?.template ?? '')
  const [pages, setPages] = useState<string[]>(integ?.landing_pages ?? [])
  const [pageInput, setPageInput] = useState('')

  const addPage = () => { const v = pageInput.trim(); if (!v) return; setPages(p => [...p, v]); setPageInput('') }
  const save = () => onSave({
    instancia: instancia.trim() || null,
    numero_destino: numero.trim() || null,
    template: template.trim() || null,
    landing_pages: pages,
  })

  const fld = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime'
  return (
    <div className="px-4 pb-4 pt-1 border-t border-bento-border/60 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-bento-dim mb-1">Instância</label>
          <input value={instancia} onChange={e => setInstancia(e.target.value)} placeholder="ex.: zapi-01" className={cn(fld, 'font-tech')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-bento-dim mb-1">Número de destino</label>
          <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="ex.: +1 415 555 0101" className={cn(fld, 'font-tech')} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-bento-dim mb-1">Template</label>
        <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={2} placeholder="Mensagem/template da automação…" className={fld} />
      </div>
      <div>
        <label className="block text-xs font-medium text-bento-dim mb-1">Landing pages</label>
        <div className="flex items-center gap-2">
          <input value={pageInput} onChange={e => setPageInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPage() } }}
            placeholder="https://…" className={cn(fld, 'font-tech flex-1')} />
          <button onClick={addPage} className="bento-btn px-3 py-2 rounded-btn text-sm font-semibold shrink-0"><Plus className="w-4 h-4" /></button>
        </div>
        {pages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pages.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 font-tech text-[11px] text-bento-dim bg-bento-bg border border-bento-border rounded-full pl-2.5 pr-1 py-0.5 max-w-full">
                <span className="truncate max-w-[200px]">{p}</span>
                <button onClick={() => setPages(ps => ps.filter((_, j) => j !== i))} className="p-0.5 text-bento-muted hover:text-red-400" aria-label="Remover"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      <button onClick={save} disabled={busy} className="bento-btn px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50">Salvar configuração</button>
    </div>
  )
}
