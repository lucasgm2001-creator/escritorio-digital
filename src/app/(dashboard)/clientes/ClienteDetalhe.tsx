'use client'

import { useState } from 'react'
import { ChevronLeft, MessageCircle, FolderOpen, FileDown, Power } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn, formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date'
import { planLabel, healthOf, type Client, type ClientIntegration } from './types'

const FUSO_LABEL: Record<string, string> = { leste: 'Leste', central: 'Central', montanha: 'Montanha', pacifico: 'Pacífico' }

export function ClienteDetalhe({ client, integration, onBack, onUpdated }: {
  client: Client
  integration?: ClientIntegration
  onBack: () => void
  onUpdated: (c: Client) => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [deact, setDeact] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const health = healthOf(client.status)
  const waOn = !!integration?.ativo
  const pages = integration?.landing_pages ?? []
  const cidade = [client.city, client.state].filter(Boolean).join(', ')
  // "Resultado" — usa dossie se houver conteúdo; senão placeholder discreto.
  const dossieEntries = Object.entries(client.dossie ?? {}).filter(([, v]) => v && (v.url || v.notas))

  const desativar = async () => {
    setBusy(true)
    const today = new Date()
    const end = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const { data, error } = await supabase.from('clients')
      .update({ status: 'inativo', end_date: end, end_reason: reason.trim() || null })
      .eq('id', client.id).select('*').single()
    setBusy(false)
    if (error || !data) { toast({ type: 'error', message: `Não foi possível desativar: ${error?.message ?? 'erro'}` }); return }
    onUpdated(data as Client)
    setDeact(false)
    toast({ type: 'success', message: 'Cliente desativado.' })
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-bento-dim hover:text-bento-text min-h-[40px]"><ChevronLeft className="w-4 h-4" />Hub</button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-lime/15 border border-lime/30 flex items-center justify-center flex-none"><span className="text-base font-bold text-lime-fg">{(client.name || '?')[0]}</span></span>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-bento-text text-lg tracking-tight truncate">{client.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn('w-2 h-2 rounded-full', health.dot)} />
              <span className="font-tech text-[11px] text-bento-muted">{health.label}</span>
            </div>
          </div>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 border border-bento-border text-bento-dim px-3 py-2 rounded-btn text-sm hover:border-lime transition-colors shrink-0"><FileDown className="w-4 h-4" />Gerar PDF</button>
      </div>

      {/* Ficha */}
      <Panel title="Ficha">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
          <Field label="Responsável" value={client.assigned_name || '—'} />
          <Field label="Nicho" value={client.nicho || '—'} />
          <Field label="Cidade" value={cidade || '—'} />
          <Field label="Cliente desde" value={formatDateBR(client.start_date)} mono />
          <Field label="E-mail" value={client.email || '—'} />
          <Field label="Telefone" value={client.phone || '—'} mono />
          <Field label="Empresa" value={client.company || '—'} />
          {client.fuso && <Field label="Fuso" value={FUSO_LABEL[client.fuso] ?? client.fuso} />}
        </div>
      </Panel>

      {/* Conta & integração */}
      <Panel title="Conta & integração">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
          <Field label="Plano" value={`${planLabel(client.plan_weekly)} · ${formatCurrency(client.plan_weekly || 0, 'en-US', 'USD')}/sem`} />
          <Field label="Prateleira" value={client.nicho || 'Sem prateleira'} />
          <Field label="Landing pages" value={String(pages.length)} mono />
          <div>
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1">WhatsApp</p>
            <span className={cn('font-tech text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1',
              waOn ? 'border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10' : 'border-bento-border text-bento-muted bg-bento-bg')}>
              <MessageCircle className="w-3 h-3" />{waOn ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          {client.drive_folder_url && (
            <div>
              <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1">Pasta</p>
              <a href={client.drive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-lime-fg hover:underline"><FolderOpen className="w-4 h-4" />Abrir pasta</a>
            </div>
          )}
        </div>
      </Panel>

      {/* Resultado */}
      <Panel title="Resultado">
        {dossieEntries.length === 0 ? (
          <p className="text-sm text-bento-muted/70 font-tech">Sem resultados registrados ainda.</p>
        ) : (
          <div className="space-y-2">
            {dossieEntries.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 bento-fx px-3 py-2">
                <span className="text-sm text-bento-text capitalize truncate">{k}{v.notas ? ` — ${v.notas}` : ''}</span>
                {v.url && <a href={v.url} target="_blank" rel="noopener noreferrer" className="font-tech text-[11px] text-lime-fg hover:underline shrink-0">abrir</a>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Desativar (rescisão) — NÃO mexe em comissão, só status/end_date/end_reason do cliente. */}
      <div className="bento-fx p-4">
        {!deact ? (
          <button onClick={() => setDeact(true)} disabled={client.status !== 'ativo'}
            className="inline-flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Power className="w-4 h-4" />{client.status === 'ativo' ? 'Desativar cliente' : 'Cliente já encerrado'}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-bento-text font-medium">Desativar “{client.name}”?</p>
            <p className="text-xs text-bento-muted">Marca o cliente como inativo e registra a data de encerramento (hoje). Não altera comissões já registradas.</p>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo (opcional)"
              className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime" />
            <div className="flex gap-2">
              <button onClick={desativar} disabled={busy} className="bg-red-500/90 hover:bg-red-500 text-white px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50">Desativar</button>
              <button onClick={() => setDeact(false)} className="border border-bento-border text-bento-dim px-4 py-2 rounded-btn text-sm hover:border-lime transition-colors">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bento-fx p-4">
      <h2 className="font-tech text-[10px] uppercase tracking-[0.14em] text-bento-muted mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-0.5">{label}</p>
      <p className={cn('text-sm text-bento-text truncate', mono && 'font-tech tabular-nums')}>{value}</p>
    </div>
  )
}
