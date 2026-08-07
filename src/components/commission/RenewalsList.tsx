'use client'

import { useCallback, useEffect, useState } from 'react'
import { RotateCcw, Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { voidRenewalAction, restoreRenewalAction } from '@/app/(dashboard)/comercial/renewal-actions'
import { usd } from '@/lib/format'
import { formatDateBR } from '@/lib/date'
import { cn } from '@/lib/utils'

// HISTÓRICO EDITÁVEL DE RENOVAÇÕES (contract_renewals). Uma linha por renovação trimestral gerada pelo robô
// (process_due_renewals). NADA some da lista: uma renovação estornada continua visível, só muda de status
// ('confirmada' ↔ 'nao_renovou') e ganha motivo + data da mudança. O dinheiro sai/volta pelo RPC do banco
// (soft-delete em weekly_payments), nunca por cálculo daqui — esta tela só mostra e dispara a decisão humana.
// Reusado pelo perfil do vendedor (por seller_id) e pela ficha do cliente (por client_id).

export type RenewalRow = {
  id: string
  client_id: string
  clientName: string | null
  renewal_number: number
  renewal_date: string
  bonus_usd: number
  status: 'confirmada' | 'nao_renovou'
  status_note: string | null
  status_changed_at: string | null
}

const SELECT_COLS = 'id, client_id, renewal_number, renewal_date, bonus_usd, status, status_note, status_changed_at'

type RawRenewal = {
  id: string; client_id: string; renewal_number: number; renewal_date: string
  bonus_usd: number | string; status: string; status_note: string | null; status_changed_at: string | null
}

// Busca as renovações + o nome do cliente (join manual: 2 queries, sem depender de embed tipado).
export async function fetchRenewals(
  supabase: ReturnType<typeof createClient>,
  filter: { sellerId?: string | null; clientId?: string | null },
): Promise<RenewalRow[]> {
  let q = supabase.from('contract_renewals').select(SELECT_COLS).order('renewal_date', { ascending: false })
  if (filter.clientId) q = q.eq('client_id', filter.clientId)
  else if (filter.sellerId) q = q.eq('seller_id', filter.sellerId)
  else return []
  const { data } = await q
  const rows = (data ?? []) as unknown as RawRenewal[]
  if (rows.length === 0) return []

  const names = new Map<string, string>()
  const ids = Array.from(new Set(rows.map(r => r.client_id)))
  const { data: cli } = await supabase.from('clients').select('id, name').in('id', ids)
  for (const c of (cli ?? []) as { id: string; name: string | null }[]) names.set(c.id, c.name ?? '')

  return rows.map(r => ({
    id: r.id, client_id: r.client_id, clientName: names.get(r.client_id) ?? null,
    renewal_number: r.renewal_number, renewal_date: r.renewal_date, bonus_usd: Number(r.bonus_usd),
    status: r.status === 'nao_renovou' ? 'nao_renovou' : 'confirmada',
    status_note: r.status_note, status_changed_at: r.status_changed_at,
  }))
}

export function RenewalsList({
  sellerId = null, clientId = null, rows: rowsProp, showClientName = true, emptyText = 'Nenhuma renovação gerada ainda.', onChanged,
}: {
  sellerId?: string | null
  clientId?: string | null
  rows?: RenewalRow[]          // lista já carregada (ex.: o aviso de desativação) — pula a busca própria
  showClientName?: boolean
  emptyText?: string
  onChanged?: () => void
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [rows, setRows] = useState<RenewalRow[]>(rowsProp ?? [])
  const [loading, setLoading] = useState(!rowsProp)
  const [confirmId, setConfirmId] = useState<string | null>(null)   // é dinheiro: nada executa sem confirmar
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (rowsProp) return
    setLoading(true)
    setRows(await fetchRenewals(supabase, { sellerId, clientId }))
    setLoading(false)
  }, [supabase, sellerId, clientId, rowsProp])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (rowsProp) setRows(rowsProp) }, [rowsProp])

  const run = async (r: RenewalRow) => {
    setBusyId(r.id)
    const voiding = r.status === 'confirmada'
    const res = voiding ? await voidRenewalAction(r.id, note) : await restoreRenewalAction(r.id, note)
    setBusyId(null)
    if (!res.ok) { toast({ type: 'error', message: res.error?.message ?? 'Não foi possível atualizar a renovação.' }); return }
    setConfirmId(null); setNote('')
    toast({
      type: 'success',
      message: voiding
        ? `Renovação marcada como não renovada — bônus de ${usd(r.bonus_usd)} estornado.`
        : `Renovação reativada — bônus de ${usd(r.bonus_usd)} de volta na comissão.`,
    })
    // Recarrega da fonte (o status/motivo/data vêm do banco, não de estado otimista — é dinheiro).
    if (!rowsProp) await load()
    onChanged?.()
  }

  if (loading) return <p className="text-xs text-bento-muted py-2">Carregando renovações…</p>
  if (rows.length === 0) return <p className="text-xs text-bento-muted py-2">{emptyText}</p>

  return (
    <div className="space-y-2">
      {rows.map(r => {
        const voided = r.status === 'nao_renovou'
        const confirming = confirmId === r.id
        const busy = busyId === r.id
        return (
          <div key={r.id} className="bg-bento-bg border border-bento-border/60 rounded-btn p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-bento-text truncate">
                  {showClientName && r.clientName ? `${r.clientName} · ` : ''}Renovação {r.renewal_number}ª
                </p>
                <p className="font-tech text-[11px] text-bento-muted tabular-nums">{formatDateBR(r.renewal_date)}</p>
              </div>
              <div className="flex items-center gap-2 flex-none">
                <span className={cn('text-sm font-medium tabular-nums', voided ? 'line-through text-bento-muted' : 'text-bento-text')}>
                  {usd(r.bonus_usd)}
                </span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium',
                  voided ? 'bg-red-500/10 text-red-300 border-red-700/50' : 'bg-lime/15 text-lime-fg border-lime/30')}>
                  {voided ? 'Não renovou' : 'Confirmada'}
                </span>
              </div>
            </div>

            {/* Histórico — nada some, só muda de status. */}
            {(r.status_note || r.status_changed_at) && (
              <p className="font-tech text-[10px] text-bento-muted">
                {r.status_changed_at ? `Alterado em ${formatDateBR(r.status_changed_at.slice(0, 10))}` : ''}
                {r.status_note ? `${r.status_changed_at ? ' · ' : ''}${r.status_note}` : ''}
              </p>
            )}

            {!confirming ? (
              <button type="button" onClick={() => { setConfirmId(r.id); setNote('') }}
                className={cn('inline-flex items-center gap-1.5 text-xs font-medium transition-colors',
                  voided ? 'text-lime-fg hover:text-lime' : 'text-red-400 hover:text-red-300')}>
                {voided ? <><RotateCcw className="w-3.5 h-3.5" />Reativar (renovou)</> : <><Ban className="w-3.5 h-3.5" />Marcar como não renovou</>}
              </button>
            ) : (
              <div className="space-y-2 border-t border-bento-border/40 pt-2">
                <p className="text-xs text-bento-text">
                  {voided
                    ? `Reativar a ${r.renewal_number}ª renovação? O bônus de ${usd(r.bonus_usd)} volta a contar na comissão.`
                    : `Marcar a ${r.renewal_number}ª renovação como NÃO renovada? O bônus de ${usd(r.bonus_usd)} sai da comissão (a linha continua no histórico).`}
                </p>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Motivo (opcional)"
                  className="w-full bg-bento-surface border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setConfirmId(null); setNote('') }} disabled={busy}
                    className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm hover:border-lime transition-colors disabled:opacity-50 min-h-[40px]">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => run(r)} disabled={busy}
                    className={cn('flex-1 py-2 rounded-btn text-sm font-semibold text-white disabled:opacity-50 min-h-[40px]',
                      voided ? 'bg-lime hover:bg-lime/90' : 'bg-red-500/90 hover:bg-red-500')}>
                    {busy ? 'Salvando…' : voided ? 'Reativar' : 'Estornar bônus'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
