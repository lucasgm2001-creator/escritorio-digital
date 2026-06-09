'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from './types'

interface Props {
  lead: Lead
  currentUser: { id: string; name: string }
  onClose: () => void
}

// Tokens bento, theme-aware. Emerald aqui é SEMÂNTICO (sucesso/venda) — mantido,
// mas em tons translúcidos que a camada de compatibilidade resolve no claro.
const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime/30'

export function CommissionModal({ lead, currentUser, onClose }: Props) {
  const [percentage, setPercentage] = useState('10')
  const [customAmount, setCustomAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const supabase = createClient()

  const baseValue = lead.value || 0
  const calculatedAmount = baseValue > 0 && percentage
    ? ((baseValue * parseFloat(percentage || '0')) / 100)
    : 0

  const finalAmount = customAmount ? parseFloat(customAmount) : calculatedAmount

  const handleSave = async () => {
    setLoading(true)
    await supabase.from('commissions').insert({
      seller_id: lead.assigned_to ?? currentUser.id,
      seller_name: lead.assigned_name ?? currentUser.name,
      lead_id: lead.id,
      lead_name: lead.name,
      amount: finalAmount,
      percentage: parseFloat(percentage || '0'),
      status: 'pendente',
      due_date: dueDate || null,
    })
    setSaved(true)
    setLoading(false)
    setTimeout(onClose, 1800)
  }

  const fmt = (v: number) =>
    v > 0 ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-sm animate-slide-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-bento-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display font-bold text-bento-text text-base">Venda Concluída!</h2>
              <p className="text-xs text-bento-muted mt-0.5">
                <strong className="text-bento-dim">{lead.name}</strong> agora é cliente
              </p>
            </div>
          </div>
        </div>

        {saved ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-emerald-400">Comissão registrada!</p>
            <p className="font-tech text-xs text-bento-muted mt-1">{fmt(finalAmount)}</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-sm text-bento-dim">
              Registre a comissão para{' '}
              <span className="font-semibold text-bento-text">
                {lead.assigned_name ?? currentUser.name}
              </span>
              :
            </p>

            {baseValue > 0 && (
              <div className="bg-bento-bg rounded-bento p-3 border border-bento-border">
                <p className="font-tech text-[11px] text-bento-muted uppercase tracking-wide">Valor do Contrato</p>
                <p className="font-display text-xl font-bold text-bento-text mt-0.5">{fmt(baseValue)}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-bento-dim mb-1.5">
                  % Comissão
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={percentage}
                    onChange={e => { setPercentage(e.target.value); setCustomAmount('') }}
                    className={`${inputCls} pr-7`}
                    placeholder="10"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bento-muted text-xs">%</span>
                </div>
                {baseValue > 0 && calculatedAmount > 0 && (
                  <p className="font-tech text-[10px] text-bento-muted mt-1 tabular-nums">= {fmt(calculatedAmount)}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-bento-dim mb-1.5">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  value={customAmount || (calculatedAmount > 0 ? calculatedAmount.toFixed(2) : '')}
                  onChange={e => setCustomAmount(e.target.value)}
                  className={inputCls}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-bento-dim mb-1.5">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={inputCls}
              />
            </div>

            {finalAmount > 0 && (
              <div className="bg-emerald-900/30 rounded-bento px-4 py-3 border border-emerald-800/50 flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-medium">Comissão a registrar</span>
                <span className="font-display text-base font-bold text-emerald-300 tabular-nums">{fmt(finalAmount)}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm font-medium hover:border-lime hover:text-bento-text transition-colors"
              >
                Pular
              </button>
              <button
                onClick={handleSave}
                disabled={loading || finalAmount <= 0}
                className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar Comissão'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
