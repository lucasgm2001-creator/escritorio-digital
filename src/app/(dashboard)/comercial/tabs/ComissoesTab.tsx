'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Commission {
  id: string
  seller_id: string
  seller_name?: string
  lead_id?: string
  lead_name?: string
  amount: number
  percentage: number
  status: 'pendente' | 'aprovada' | 'paga'
  due_date?: string
  paid_at?: string
  created_at: string
}

interface Props {
  currentUser: { id: string; name: string; role: string }
}

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', bg: 'bg-amber-900/30',   text: 'text-amber-400',   border: 'border-amber-800/50' },
  aprovada: { label: 'Aprovada', bg: 'bg-blue-900/30',    text: 'text-blue-400',    border: 'border-blue-800/50'  },
  paga:     { label: 'Paga',     bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-800/50' },
} as const

export function ComissoesTab({ currentUser }: Props) {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'todos' | Commission['status']>('todos')

  const supabase = createClient()
  const canManageAll = currentUser.role === 'admin' || currentUser.role === 'financeiro'

  useEffect(() => {
    const load = async () => {
      let q = supabase.from('commissions').select('*').order('created_at', { ascending: false })
      if (!canManageAll) q = q.eq('seller_id', currentUser.id)
      const { data } = await q
      setCommissions(data ?? [])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStatusChange = async (id: string, status: Commission['status']) => {
    if (!canManageAll) return
    await supabase.from('commissions').update({
      status,
      paid_at: status === 'paga' ? new Date().toISOString() : null,
    }).eq('id', id)
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  const filtered = statusFilter === 'todos'
    ? commissions
    : commissions.filter(c => c.status === statusFilter)

  const total    = commissions.reduce((s, c) => s + c.amount, 0)
  const pendente = commissions.filter(c => c.status === 'pendente').reduce((s, c) => s + c.amount, 0)
  const pago     = commissions.filter(c => c.status === 'paga').reduce((s, c) => s + c.amount, 0)

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-6 space-y-5 overflow-auto h-full bg-background">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#161b22] rounded-xl border border-[#2d3748] p-5 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total de Comissões</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{fmt(total)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{commissions.length} registros</p>
        </div>
        <div className="stat-card before:bg-amber-500">
          <p className="text-xs text-amber-400 font-medium">A Pagar</p>
          <p className="text-2xl font-bold text-amber-300 mt-1 tabular-nums">{fmt(pendente)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {commissions.filter(c => c.status === 'pendente').length} pendentes
          </p>
        </div>
        <div className="stat-card before:bg-emerald-500">
          <p className="text-xs text-emerald-400 font-medium">Pago</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1 tabular-nums">{fmt(pago)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {commissions.filter(c => c.status === 'paga').length} pagos
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b22] rounded-xl border border-[#2d3748] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#2d3748]">
          <h3 className="font-semibold text-foreground text-sm">
            {canManageAll ? 'Todas as Comissões' : 'Minhas Comissões'}
          </h3>
          <div className="flex gap-1 bg-[#1e2533] rounded-lg p-1">
            {(['todos', 'pendente', 'aprovada', 'paga'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                  statusFilter === s
                    ? 'bg-[#161b22] text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                {s === 'todos' ? 'Todos' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            {commissions.length === 0 ? 'Nenhuma comissão registrada' : 'Nenhuma comissão com este filtro'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0d1117]/50 border-b border-[#2d3748]">
                  {canManageAll && (
                    <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Vendedor</th>
                  )}
                  <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Lead</th>
                  <th className="text-right text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">%</th>
                  <th className="text-right text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Valor</th>
                  <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Vencimento</th>
                  <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Status</th>
                  {canManageAll && (
                    <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Alterar</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d3748]/60">
                {filtered.map(c => {
                  const s = STATUS_CONFIG[c.status]
                  return (
                    <tr key={c.id} className="hover:bg-[#0d1117]/50 transition-colors">
                      {canManageAll && (
                        <td className="px-4 py-3 text-muted-foreground font-medium">{c.seller_name ?? '—'}</td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground">{c.lead_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{c.percentage}%</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums">{fmt(c.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {c.due_date ? new Date(c.due_date).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${s.bg} ${s.text} ${s.border}`}>
                          {s.label}
                        </span>
                      </td>
                      {canManageAll && (
                        <td className="px-4 py-3">
                          <select
                            value={c.status}
                            onChange={e => handleStatusChange(c.id, e.target.value as Commission['status'])}
                            className="text-xs border border-[#2d3748] rounded-lg px-2.5 py-1 focus:outline-none focus:border-primary-600 bg-[#1e2533] text-foreground"
                          >
                            <option value="pendente">Pendente</option>
                            <option value="aprovada">Aprovada</option>
                            <option value="paga">Paga</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
