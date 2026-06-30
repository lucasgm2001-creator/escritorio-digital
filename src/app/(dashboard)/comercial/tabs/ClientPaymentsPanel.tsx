'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronRight, X, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { payDueWeeks, voidClientWeek } from '@/lib/commission/actions'
import { formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date'
import { cn } from '@/lib/utils'

// Pagamento/estorno por semana de UM cliente (receita = client_payments). Mesma fonte e MESMAS server actions
// de antes (payDueWeeks / voidClientWeek); a lógica de dinheiro vive em commission/actions.ts (intocada) — aqui
// é só a UI que as chama. Vive dentro do CommissionSection (atrás do PIN do box do vendedor).
interface ClientPayment { id: string; numero_semana: number; valor_usd: number; paid_on: string; anulado?: boolean }

export function ClientPaymentsPanel({ clients }: { clients: { id: string; name: string }[] }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [payments, setPayments] = useState<Record<string, ClientPayment[]>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const busyRef = useRef(false)
  const [voidState, setVoidState] = useState<{ clientId: string; name: string; numero: number; motivo: string } | null>(null)
  const voidDialog = useDialog<HTMLDivElement>(() => setVoidState(null), !!voidState)

  const ids = useMemo(() => clients.map(c => c.id), [clients])
  const idsKey = ids.join(',')

  // Carrega as semanas (client_payments) dos clientes do vendedor — MESMA query/fonte de hoje.
  useEffect(() => {
    if (ids.length === 0) { setPayments({}); return }
    let on = true
    supabase.from('client_payments').select('*').in('client_id', ids).then(({ data }) => {
      if (!on) return
      const map: Record<string, ClientPayment[]> = {}
      for (const r of data ?? []) (map[(r as { client_id: string }).client_id] ??= []).push(r as unknown as ClientPayment)
      setPayments(map)
    })
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, supabase])

  const reload = async (clientId: string) => {
    const { data } = await supabase.from('client_payments').select('*').eq('client_id', clientId)
    setPayments(prev => ({ ...prev, [clientId]: (data ?? []) as unknown as ClientPayment[] }))
  }

  // Cotação efetiva (mesma do /api/fx) — congela no lançamento, nunca 0.
  const getRate = async (): Promise<number> => {
    try {
      const res = await fetch('/api/fx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (res.ok) { const d = await res.json(); const r = Number(d.effective); if (r > 0) return r }
    } catch { /* fallback abaixo */ }
    return 5.40
  }

  // Marca semana(s) VENCIDA(s) via payDueWeeks (max=1 marca a próxima; max=4 = "pagar mês"). Guarda anti-duplo-clique.
  const markWeeks = async (clientId: string, max: number) => {
    if (busyRef.current) return
    busyRef.current = true; setBusyId(clientId)
    try {
      const r = await payDueWeeks(supabase, clientId, await getRate(), max)
      if (r.marked.length === 0) { toast({ type: 'error', message: r.reason === 'inativo' ? 'Cliente inativo — congelado.' : 'Nenhuma semana vencida até hoje.' }); return }
      await reload(clientId)
    } finally { busyRef.current = false; setBusyId(null) }
  }

  // Gatilho manual do agendador NESTE cliente (testa o caminho server-side).
  const runAuto = async (clientId: string) => {
    if (busyRef.current) return
    busyRef.current = true; setBusyId(clientId)
    try {
      const res = await fetch('/api/commission/auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) })
      const j = await res.json().catch(() => ({}))
      await reload(clientId)
      toast({ type: j?.ok ? 'success' : 'error', message: j?.result ? `Auto: ${j.result}` : (j?.ok ? 'Auto executado.' : 'Falha ao rodar o auto.') })
    } catch {
      toast({ type: 'error', message: 'Falha ao rodar o auto (rede).' })
    } finally { busyRef.current = false; setBusyId(null) }
  }

  // Estorno: anula a semana (flag, sem hard-delete) + remove a comissão derivada — via voidClientWeek (RPC
  // void_client_week). Confirmação com MOTIVO no modal (useDialog: ESC/focus-trap/scroll-lock).
  const confirmVoid = async () => {
    if (!voidState || busyRef.current) return
    const { clientId, numero, motivo } = voidState
    busyRef.current = true; setBusyId(clientId)
    try {
      const res = await voidClientWeek(supabase, clientId, numero, motivo.trim() || null)
      if (!res.ok) { toast({ type: 'error', message: res.message || 'Não foi possível anular a semana.' }); return }
      setVoidState(null)
      await reload(clientId)
      toast({ type: 'success', message: `Semana ${numero} anulada.` })
    } finally { busyRef.current = false; setBusyId(null) }
  }

  if (clients.length === 0) return null

  return (
    <div className="bento-fx overflow-hidden">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left">
        <Wallet className="w-4 h-4 text-lime-fg flex-none" />
        <span className="font-display font-bold text-bento-text text-sm flex-1">Receber por semana (cliente)</span>
        <span className="font-tech text-[10px] text-bento-muted">{clients.length} cliente(s)</span>
        <ChevronRight className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-bento-border/60 space-y-2">
          <p className="font-tech text-[10px] text-bento-muted px-1">Receita do contrato (semanas pagas). Marcar paga / anular não recalcula nada — usa as mesmas regras do agendador.</p>
          {clients.map(c => {
            const pays = (payments[c.id] ?? []).slice().sort((a, b) => a.numero_semana - b.numero_semana)
            const paidNums = new Set(pays.map(p => p.numero_semana))
            const totalRecebido = pays.filter(p => !p.anulado).reduce((s, p) => s + Number(p.valor_usd), 0)
            let nextUnpaid = 1; while (paidNums.has(nextUnpaid)) nextUnpaid++
            const expanded = openId === c.id
            const busy = busyId === c.id
            return (
              <div key={c.id} className="bg-bento-bg border border-bento-border/60 rounded-btn overflow-hidden">
                <button onClick={() => setOpenId(p => p === c.id ? null : c.id)} aria-expanded={expanded}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                  <span className="text-sm font-medium text-bento-text flex-1 truncate">{c.name}</span>
                  <span className="font-tech text-[11px] text-bento-dim tabular-nums">{formatCurrency(totalRecebido, 'en-US', 'USD')}</span>
                  <span className="font-tech text-[10px] text-bento-muted tabular-nums">{pays.filter(p => !p.anulado).length} sem.</span>
                  <ChevronRight className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', expanded && 'rotate-90')} />
                </button>
                {expanded && (
                  <div className="px-3 pb-3 border-t border-bento-border/60 pt-2.5">
                    {pays.length === 0 ? (
                      <p className="text-xs text-bento-muted mb-3">Nenhuma semana registrada.</p>
                    ) : (
                      <div className="space-y-1 mb-3">
                        {pays.map(p => (
                          <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-tech text-bento-dim tabular-nums">S{p.numero_semana} · {formatDateBR(p.paid_on)}</span>
                            <span className="flex items-center gap-2">
                              <span className={cn('font-tech tabular-nums', p.anulado ? 'line-through text-bento-muted' : 'text-bento-text')}>{formatCurrency(Number(p.valor_usd), 'en-US', 'USD')}</span>
                              {p.anulado
                                ? <span className="text-[10px] text-red-400 font-semibold">anulada</span>
                                : <button onClick={() => setVoidState({ clientId: c.id, name: c.name, numero: p.numero_semana, motivo: '' })} disabled={busy} className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50">Anular</button>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => markWeeks(c.id, 1)} disabled={busy}
                        className="bento-btn px-3 py-1.5 rounded-btn text-xs font-semibold disabled:opacity-50">
                        {busy ? 'Registrando...' : `Marcar semana ${nextUnpaid}`}
                      </button>
                      <button onClick={() => markWeeks(c.id, 4)} disabled={busy}
                        className="px-3 py-1.5 rounded-btn text-xs border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50">
                        Pagar mês (4 semanas)
                      </button>
                      <button onClick={() => runAuto(c.id)} disabled={busy} title="Testa o agendador neste cliente (server-side)"
                        className="px-3 py-1.5 rounded-btn text-xs border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50">
                        Rodar auto agora
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de ESTORNO com MOTIVO (useDialog: ESC/focus-trap/scroll-lock). */}
      {voidState && (
        <Portal>
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setVoidState(null)} />
            <div ref={voidDialog.ref} {...voidDialog.dialogProps} aria-labelledby="void-title" className="relative w-full max-w-sm bg-bento-panel border border-bento-border rounded-bento shadow-card-hover p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 id="void-title" className="font-display font-bold text-bento-text">Anular semana {voidState.numero}</h3>
                <button onClick={() => setVoidState(null)} aria-label="Fechar" className="p-1 text-bento-muted hover:text-bento-text"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-bento-muted">Anula a receita da semana {voidState.numero} de <span className="text-bento-text">{voidState.name}</span> e remove a comissão derivada. O registro NÃO é apagado (fica marcado como anulado).</p>
              <textarea value={voidState.motivo} onChange={e => setVoidState(v => v && { ...v, motivo: e.target.value })} rows={2}
                placeholder="Motivo (opcional)" className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime" />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setVoidState(null)} className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm hover:border-lime transition-colors">Cancelar</button>
                <button onClick={confirmVoid} disabled={busyId === voidState.clientId} className="flex-1 bg-red-500/90 hover:bg-red-500 text-white py-2 rounded-btn text-sm font-semibold disabled:opacity-50">Anular semana</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
