'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, MessageCircle, FolderOpen, FileDown, Power, ArrowRight, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useRole } from '@/components/auth/RoleProvider'
import { softDeleteClientAction, updateClientAction, deactivateClientAction } from './client-write-actions'
import { cn, formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date'
import { planLabel, healthOf, type Client, type Nicho, type ClientIntegration } from './types'
import { createClient } from '@/lib/supabase/client'

const FUSO_LABEL: Record<string, string> = { leste: 'Leste', central: 'Central', montanha: 'Montanha', pacifico: 'Pacífico' }

export function ClienteDetalhe({ client, nichos, integration, onBack, onUpdated }: {
  client: Client
  nichos: Nicho[]
  integration?: ClientIntegration
  onBack: () => void
  onUpdated: (c: Client) => void
}) {
  const { toast } = useToast()
  const role = useRole()
  const [deact, setDeact] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [nicho, setNicho] = useState<string | null>(client.nicho ?? null)
  const [savingNicho, setSavingNicho] = useState(false)
  const [supplement, setSupplement] = useState<Pick<Client, 'drive_folder_url' | 'dossie'>>({
    drive_folder_url: client.drive_folder_url,
    dossie: client.dossie,
  })
  const [loadingSupplement, setLoadingSupplement] = useState(
    client.drive_folder_url === undefined && client.dossie === undefined,
  )

  // O Hub recebe somente a ficha leve de cada cliente. Drive e dossiê, que podem ser grandes, são
  // buscados apenas quando este detalhe é aberto — sem multiplicar o payload pelo total de clientes.
  useEffect(() => {
    if (!loadingSupplement) return
    let active = true
    createClient()
      .from('clients')
      .select('drive_folder_url, dossie')
      .eq('id', client.id)
      .single()
      .then(({ data }) => {
        if (active && data) setSupplement(data as Pick<Client, 'drive_folder_url' | 'dossie'>)
        if (active) setLoadingSupplement(false)
      }, () => { if (active) setLoadingSupplement(false) })
    return () => { active = false }
  }, [client.id, loadingSupplement])

  // Prateleiras ATIVAS (por posicao). Se a atual não estiver entre elas, vira opção extra p/ não sumir do select.
  const activeNichos = nichos.filter(n => n.ativo).sort((a, b) => a.posicao - b.posicao)
  const currentMissing = !!nicho && !activeNichos.some(n => n.nome === nicho)

  // Troca de prateleira: otimista + UPDATE clients.nicho (+ updated_at). onUpdated reflete no Hub na hora
  // (estado/realtime do ClientesFloor). Erro → reverte o select + toast.
  const changeNicho = async (value: string) => {
    const next = value === '' ? null : value
    const prev = nicho
    if (next === (client.nicho ?? null)) { setNicho(next); return }
    setNicho(next)
    setSavingNicho(true)
    const r = await updateClientAction(client.id, { nicho: next })
    setSavingNicho(false)
    if (!r.ok) { setNicho(prev); toast({ type: 'error', message: `Não foi possível mudar a prateleira: ${r.error}` }); return }
    onUpdated({ ...client, nicho: next ?? undefined })
    toast({ type: 'success', message: next ? `Movido para "${next}".` : 'Movido para "Sem prateleira".' })
  }

  const health = healthOf(client.status)
  const waOn = !!integration?.ativo
  const pages = integration?.landing_pages ?? []
  const cidade = [client.city, client.state].filter(Boolean).join(', ')
  // "Resultado" — usa dossie se houver conteúdo; senão placeholder discreto.
  const dossieEntries = Object.entries(supplement.dossie ?? {}).filter(([, v]) => v && (v.url || v.notas))

  const desativar = async () => {
    setBusy(true)
    const r = await deactivateClientAction(client.id, reason.trim() || null)
    setBusy(false)
    if (!r.ok) { toast({ type: 'error', message: `Não foi possível desativar: ${r.error}` }); return }
    onUpdated({ ...client, status: 'inativo', end_date: r.endDate })
    setDeact(false)
    toast({ type: 'success', message: 'Cliente desativado.' })
  }

  // Excluir (SOFT DELETE global, F4) — OWNER-ONLY. Diferente de Desativar (churn): "some de tudo" (receita,
  // comissão, relatórios, métricas...) e vai para a Lixeira, reversível. O RPC valida o owner no servidor.
  const excluir = async () => {
    if (!confirm(`Excluir "${client.name}"? Some de tudo (receita, comissão, relatórios, métricas) mas fica na Lixeira para restaurar.`)) return
    setBusy(true)
    const r = await softDeleteClientAction(client.id)
    setBusy(false)
    if (!r.ok) { toast({ type: 'error', message: r.error }); return }
    toast({ type: 'success', message: 'Cliente excluído (na Lixeira).' })
    onBack()
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
        <Link href={`/clientes/${client.id}`} className="inline-flex items-center gap-1.5 bento-btn px-3 py-2 rounded-btn text-sm font-semibold shrink-0"><ArrowRight className="w-4 h-4" />Abrir workspace</Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 border border-bento-border text-bento-dim px-3 py-2 rounded-btn text-sm hover:border-lime transition-colors shrink-0"><FileDown className="w-4 h-4" />Gerar PDF</button>
      </div>

      {/* Ficha */}
      <Panel title="Ficha">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
          <Field label="Responsável" value={client.assigned_name || '—'} />
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
          <div>
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1">Nicho / Prateleira</p>
            <select value={nicho ?? ''} onChange={e => changeNicho(e.target.value)} disabled={savingNicho}
              className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime disabled:opacity-60">
              <option value="">Sem prateleira</option>
              {activeNichos.map(n => <option key={n.id} value={n.nome}>{n.nome}</option>)}
              {currentMissing && <option value={nicho ?? ''}>{nicho} (inativa)</option>}
            </select>
          </div>
          <Field label="Landing pages" value={String(pages.length)} mono />
          <div>
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1">WhatsApp</p>
            <span className={cn('font-tech text-[11px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1',
              waOn ? 'border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/10' : 'border-bento-border text-bento-muted bg-bento-bg')}>
              <MessageCircle className="w-3 h-3" />{waOn ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          {supplement.drive_folder_url && (
            <div>
              <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1">Pasta</p>
              <a href={supplement.drive_folder_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-lime-fg hover:underline"><FolderOpen className="w-4 h-4" />Abrir pasta</a>
            </div>
          )}
        </div>
      </Panel>

      {/* Resultado */}
      <Panel title="Resultado">
        {loadingSupplement ? (
          <p className="text-sm text-bento-muted/70 font-tech">Carregando resultados…</p>
        ) : dossieEntries.length === 0 ? (
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
          <div className="flex items-center gap-4 flex-wrap">
            <button onClick={() => setDeact(true)} disabled={client.status !== 'ativo'}
              className="inline-flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Power className="w-4 h-4" />{client.status === 'ativo' ? 'Desativar cliente' : 'Cliente já encerrado'}
            </button>
            {/* Excluir (F4) — só o OWNER. Some de tudo + Lixeira (reversível). Diferente de Desativar. */}
            {role === 'owner' && (
              <button onClick={excluir} disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> Excluir (Lixeira)
              </button>
            )}
          </div>
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
