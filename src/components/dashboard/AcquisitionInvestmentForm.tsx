'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMarketingInvestmentAction } from '@/app/(dashboard)/comercial/dashboard/investment-actions'
import { todaySP } from '@/lib/date'

const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime'

// Form pequeno p/ lançar investimento em marketing (Aquisição). Insere via server action e reusa
// router.refresh() (mesmo padrão de WorkspaceSwitcher/RoleEditor) p/ o Dashboard reler o VM já com o novo total.
export function AcquisitionInvestmentForm() {
  const router = useRouter()
  const [spentOn, setSpentOn] = useState(todaySP())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (saving) return
    const value = Number(amount)
    if (!spentOn || !Number.isFinite(value) || value <= 0) { setError('Informe uma data e um valor válido.'); return }
    setSaving(true); setError(null)
    try {
      const res = await createMarketingInvestmentAction({ spentOn, amountUsd: value, note: note.trim() || null })
      if (!res.ok) { setError(res.error); return }
      setAmount(''); setNote('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 border-t border-bento-border/60 pt-3 mt-1">
      <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Lançar investimento do período</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input type="date" value={spentOn} onChange={e => setSpentOn(e.target.value)} className={inputCls} aria-label="Data" />
        <input type="number" min="0" step="0.01" placeholder="Valor (USD)" value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} aria-label="Valor em USD" />
        <input type="text" placeholder="Nota (opcional)" value={note} onChange={e => setNote(e.target.value)} className={inputCls} aria-label="Nota" />
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <button onClick={save} disabled={saving} className="bento-btn px-3 py-2 min-h-[40px] rounded-btn text-xs font-semibold disabled:opacity-50">
        {saving ? 'Salvando…' : 'Lançar investimento'}
      </button>
    </div>
  )
}
