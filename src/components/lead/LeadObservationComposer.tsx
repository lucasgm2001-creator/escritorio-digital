'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addLeadObservationAction } from '@/app/(dashboard)/comercial/lead-hub-actions'

// Compositor de observação (Perfil do Lead). Cai na MESMA timeline (lead_interactions). router.refresh()
// recarrega a timeline do servidor — uma fonte de verdade, sem estado paralelo.
export function LeadObservationComposer({ leadId }: { leadId: string }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const submit = () => {
    const clean = text.trim()
    if (!clean || pending) return
    setError(null)
    startTransition(async () => {
      const result = await addLeadObservationAction(leadId, clean)
      if (!result.ok) { setError(result.error); return }
      setText('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        placeholder="Escreva uma observação..."
        className="w-full bg-bento-panel/40 border border-bento-border rounded-bento px-3 py-2 text-sm text-bento-text placeholder-bento-dim focus:outline-none focus:border-lime/60 resize-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !text.trim()}
          className="bento-btn px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[40px]"
        >
          {pending ? 'Salvando...' : 'Adicionar observação'}
        </button>
      </div>
    </div>
  )
}
