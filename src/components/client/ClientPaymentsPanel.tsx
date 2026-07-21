'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Pencil, Plus, Wallet, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { saveClientWeekAction, type ClientWeekStatus } from '@/app/(dashboard)/clientes/client-write-actions'
import { dueDateFor } from '@/lib/commission/actions'
import { formatCurrency, cn } from '@/lib/utils'
import { formatDateBR, todaySP } from '@/lib/date'

type ClientPayment = {
  id: string
  client_id: string
  numero_semana: number
  valor_usd: number
  paid_on: string | null
  due_on?: string | null
  plano_id?: string | null
  status?: ClientWeekStatus
  valor_previsto_usd?: number | null
  valor_pago_usd?: number | null
  observacao?: string | null
  anulado?: boolean
}
type ClientMeta = { id: string; start_date: string | null; billing_anchor_date: string | null; dia_pagamento_semana: number | null; plano_id: string | null; plan_weekly: number | null }
type Plan = { id: string; nome: string; valor_semanal: number }
type Editor = {
  clientId: string
  clientName: string
  numero: number
  status: ClientWeekStatus
  dueOn: string
  valorPrevisto: string
  valorPago: string
  paidOn: string
  planoId: string
  observacao: string
}

const STATUS_LABEL: Record<ClientWeekStatus, string> = {
  prevista: 'Prevista', vencida: 'Vencida', paga: 'Paga', nao_paga: 'Não paga',
  parcial: 'Parcial', isenta: 'Isenta', anulada: 'Anulada',
}
const STATUS_TONE: Record<ClientWeekStatus, string> = {
  prevista: 'text-sky-300 bg-sky-500/10', vencida: 'text-amber-300 bg-amber-500/10',
  paga: 'text-emerald-300 bg-emerald-500/10', nao_paga: 'text-red-300 bg-red-500/10',
  parcial: 'text-orange-300 bg-orange-500/10', isenta: 'text-bento-dim bg-white/5',
  anulada: 'text-red-300 bg-red-500/10',
}
const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime'
const normalizedStatus = (p: ClientPayment): ClientWeekStatus => p.status ?? (p.anulado ? 'anulada' : 'paga')

export function ClientPaymentsPanel({
  clients,
  defaultOpen = false,
  defaultClientId = null,
  title = 'Financeiro semanal dos clientes',
}: {
  clients: { id: string; name: string }[]
  defaultOpen?: boolean
  defaultClientId?: string | null
  title?: string
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [open, setOpen] = useState(defaultOpen)
  const [payments, setPayments] = useState<Record<string, ClientPayment[]>>({})
  const [meta, setMeta] = useState<Record<string, ClientMeta>>({})
  const [plans, setPlans] = useState<Plan[]>([])
  const [openId, setOpenId] = useState<string | null>(defaultClientId)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [saving, setSaving] = useState(false)
  const dialog = useDialog<HTMLDivElement>(() => setEditor(null), !!editor)
  const ids = useMemo(() => clients.map(c => c.id), [clients])
  const idsKey = ids.join(',')

  useEffect(() => {
    if (!ids.length) { setPayments({}); setMeta({}); return }
    let active = true
    Promise.all([
      supabase.from('client_payments').select('*').in('client_id', ids),
      supabase.from('clients').select('id, start_date, billing_anchor_date, dia_pagamento_semana, plano_id, plan_weekly').in('id', ids),
      supabase.from('plans').select('id, nome, valor_semanal').eq('ativo', true).order('ordem'),
    ]).then(([payRes, clientRes, planRes]) => {
      if (!active) return
      const grouped: Record<string, ClientPayment[]> = {}
      for (const row of payRes.data ?? []) (grouped[(row as ClientPayment).client_id] ??= []).push(row as ClientPayment)
      setPayments(grouped)
      setMeta(Object.fromEntries(((clientRes.data ?? []) as ClientMeta[]).map(c => [c.id, c])))
      setPlans((planRes.data ?? []) as Plan[])
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const reload = async (clientId: string) => {
    const { data } = await supabase.from('client_payments').select('*').eq('client_id', clientId)
    setPayments(prev => ({ ...prev, [clientId]: (data ?? []) as ClientPayment[] }))
  }

  const openNew = (client: { id: string; name: string }) => {
    const rows = payments[client.id] ?? []
    const used = new Set(rows.map(r => r.numero_semana))
    let numero = 1; while (used.has(numero)) numero++
    const c = meta[client.id]
    const start = c?.billing_anchor_date?.slice(0, 10) || c?.start_date?.slice(0, 10) || todaySP()
    const dia = c?.dia_pagamento_semana ?? new Date(`${start}T12:00:00Z`).getUTCDay()
    const dueOn = dueDateFor(start, dia, numero)
    const status: ClientWeekStatus = dueOn < todaySP() ? 'vencida' : 'prevista'
    setEditor({ clientId: client.id, clientName: client.name, numero, status, dueOn, valorPrevisto: String(c?.plan_weekly ?? 0), valorPago: '', paidOn: '', planoId: c?.plano_id ?? '', observacao: '' })
  }

  const openEdit = (client: { id: string; name: string }, p: ClientPayment) => {
    const status = normalizedStatus(p)
    setEditor({
      clientId: client.id, clientName: client.name, numero: p.numero_semana, status,
      dueOn: p.due_on || p.paid_on || todaySP(),
      valorPrevisto: String(p.valor_previsto_usd ?? p.valor_usd ?? 0),
      valorPago: String(p.valor_pago_usd ?? (status === 'paga' ? p.valor_usd : 0)),
      paidOn: p.paid_on || '', planoId: p.plano_id ?? '', observacao: p.observacao ?? '',
    })
  }

  const changeStatus = (status: ClientWeekStatus) => setEditor(e => {
    if (!e) return e
    const receives = status === 'paga' || status === 'parcial'
    return { ...e, status, paidOn: receives ? (e.paidOn || todaySP()) : '', valorPago: receives ? (e.valorPago || e.valorPrevisto) : '0' }
  })

  const save = async () => {
    if (!editor || saving) return
    const expected = Number(editor.valorPrevisto)
    const paid = Number(editor.valorPago || 0)
    if (!Number.isFinite(expected) || expected < 0) { toast({ type: 'error', message: 'Informe um valor previsto válido.' }); return }
    if (editor.status === 'paga' && (!editor.paidOn || paid <= 0 || paid < expected)) {
      toast({ type: 'error', message: 'Para marcar como paga, informe a data e o valor integral recebido.' }); return
    }
    if (editor.status === 'parcial' && (!editor.paidOn || paid <= 0 || paid >= expected)) {
      toast({ type: 'error', message: 'O pagamento parcial deve ser maior que zero e menor que o valor previsto.' }); return
    }
    setSaving(true)
    try {
      const res = await saveClientWeekAction({
        clientId: editor.clientId, numeroSemana: editor.numero, status: editor.status,
        dueOn: editor.dueOn, valorPrevistoUsd: expected, valorPagoUsd: paid,
        paidOn: editor.paidOn || null, planoId: editor.planoId || null, observacao: editor.observacao || null,
      })
      if (!res.ok) { toast({ type: 'error', message: res.error }); return }
      await reload(editor.clientId)
      if (editor.numero === 1 && editor.status === 'paga' && editor.paidOn) {
        const weekday = new Date(`${editor.paidOn}T12:00:00Z`).getUTCDay()
        setMeta(prev => ({ ...prev, [editor.clientId]: { ...prev[editor.clientId], billing_anchor_date: editor.paidOn, dia_pagamento_semana: weekday } }))
      }
      setEditor(null)
      toast({ type: 'success', message: `Semana ${editor.numero} atualizada como ${STATUS_LABEL[editor.status].toLowerCase()}.` })
    } finally { setSaving(false) }
  }

  if (!clients.length) return null
  return (
    <div className="bento-fx overflow-hidden">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center gap-2.5 px-4 py-3 text-left">
        <Wallet className="w-4 h-4 text-lime-fg" />
        <span className="font-display font-bold text-bento-text text-sm flex-1">{title}</span>
        <span className="font-tech text-[10px] text-bento-muted">{clients.length} cliente(s)</span>
        <ChevronRight className={cn('w-4 h-4 text-bento-muted transition-transform', open && 'rotate-90')} />
      </button>
      {open && <div className="px-3 pb-3 pt-2 border-t border-bento-border/60 space-y-2">
        <p className="font-tech text-[10px] text-bento-muted px-1">Vencimento não é pagamento. A receita e a comissão só são liberadas após confirmação.</p>
        {clients.map(client => {
          const rows = (payments[client.id] ?? []).slice().sort((a, b) => a.numero_semana - b.numero_semana)
          const total = rows.filter(p => ['paga', 'parcial'].includes(normalizedStatus(p))).reduce((sum, p) => sum + Number(p.valor_pago_usd ?? p.valor_usd ?? 0), 0)
          const expanded = openId === client.id
          return <div key={client.id} className="bg-bento-bg border border-bento-border/60 rounded-btn overflow-hidden">
            <button onClick={() => setOpenId(v => v === client.id ? null : client.id)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
              <span className="text-sm font-medium text-bento-text flex-1 truncate">{client.name}</span>
              <span className="font-tech text-[11px] text-bento-dim">{formatCurrency(total, 'en-US', 'USD')}</span>
              <ChevronRight className={cn('w-4 h-4 text-bento-muted transition-transform', expanded && 'rotate-90')} />
            </button>
            {expanded && <div className="px-3 pb-3 border-t border-bento-border/60 pt-2.5 space-y-2">
              {rows.length === 0 && <p className="text-xs text-bento-muted">Nenhuma semana cadastrada.</p>}
              {rows.map(p => {
                const status = normalizedStatus(p)
                const amount = ['paga', 'parcial'].includes(status) ? Number(p.valor_pago_usd ?? p.valor_usd) : Number(p.valor_previsto_usd ?? p.valor_usd)
                return <button key={p.id} onClick={() => openEdit(client, p)} className="w-full flex items-center gap-2 rounded-btn px-2 py-1.5 hover:bg-white/[0.03] text-left">
                  <span className="font-tech text-xs text-bento-dim w-20">S{p.numero_semana} · {formatDateBR(p.due_on || p.paid_on)}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>
                  <span className="font-tech text-xs text-bento-text ml-auto">{formatCurrency(amount, 'en-US', 'USD')}</span>
                  <Pencil className="w-3.5 h-3.5 text-bento-muted" />
                </button>
              })}
              <button onClick={() => openNew(client)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs border border-lime/40 text-lime-fg hover:bg-lime/10">
                <Plus className="w-3.5 h-3.5" /> Nova semana
              </button>
            </div>}
          </div>
        })}
      </div>}

      {editor && <Portal><div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={() => setEditor(null)} />
        <div ref={dialog.ref} {...dialog.dialogProps} aria-labelledby="week-editor-title" className="relative w-full max-w-lg bg-bento-panel border border-bento-border rounded-bento shadow-card-hover p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div><h3 id="week-editor-title" className="font-display font-bold text-bento-text">Semana {editor.numero}</h3><p className="text-xs text-bento-muted">{editor.clientName}</p></div>
            <button onClick={() => setEditor(null)} aria-label="Fechar" className="text-bento-muted hover:text-bento-text"><X className="w-4 h-4" /></button>
          </div>
          <div><label className="block text-xs text-bento-dim mb-1">Situação</label><select value={editor.status} onChange={e => changeStatus(e.target.value as ClientWeekStatus)} className={inputCls}>{Object.entries(STATUS_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-bento-dim mb-1">Vencimento</label><input type="date" value={editor.dueOn} onChange={e => setEditor(v => v && ({ ...v, dueOn: e.target.value }))} className={inputCls} /></div>
            <div><label className="block text-xs text-bento-dim mb-1">Plano da semana</label><select value={editor.planoId} onChange={e => setEditor(v => v && ({ ...v, planoId: e.target.value }))} className={inputCls}><option value="">Valor personalizado</option>{plans.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-bento-dim mb-1">Valor previsto (USD)</label><input type="number" min="0" step="0.01" value={editor.valorPrevisto} onChange={e => setEditor(v => v && ({ ...v, valorPrevisto: e.target.value }))} className={inputCls} /></div>
            <div><label className="block text-xs text-bento-dim mb-1">Valor recebido (USD)</label><input type="number" min="0" step="0.01" disabled={!['paga', 'parcial'].includes(editor.status)} value={editor.valorPago} onChange={e => setEditor(v => v && ({ ...v, valorPago: e.target.value }))} className={cn(inputCls, 'disabled:opacity-50')} /></div>
          </div>
          {['paga', 'parcial'].includes(editor.status) && <div><label className="block text-xs text-bento-dim mb-1">Data do recebimento</label><input type="date" value={editor.paidOn} onChange={e => setEditor(v => v && ({ ...v, paidOn: e.target.value }))} className={inputCls} /></div>}
          <div><label className="block text-xs text-bento-dim mb-1">Observação</label><textarea rows={3} value={editor.observacao} onChange={e => setEditor(v => v && ({ ...v, observacao: e.target.value }))} placeholder="Ex.: cliente pediu prazo até sexta-feira" className={inputCls} /></div>
          <div className="rounded-btn bg-bento-bg border border-bento-border/60 p-3 text-xs text-bento-muted">
            {editor.status === 'paga' ? 'Ao salvar, a receita será confirmada e a comissão vinculada será liberada.' : editor.status === 'parcial' ? 'O valor parcial entra na receita; a comissão aguarda o pagamento completo.' : 'Esta semana não entrará na receita e não gerará comissão.'}
            {editor.numero === 1 && editor.status === 'paga' && <span className="block mt-1 text-lime-fg">A primeira semana define o dia fixo das próximas cobranças.</span>}
          </div>
          <div className="flex gap-2"><button onClick={() => setEditor(null)} className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm">Cancelar</button><button onClick={save} disabled={saving} className="bento-btn flex-1 py-2 rounded-btn text-sm font-semibold disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar semana'}</button></div>
        </div>
      </div></Portal>}
    </div>
  )
}
