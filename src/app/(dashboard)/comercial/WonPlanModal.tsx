'use client'

import { useEffect, useState } from 'react'
import { Trophy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { usd } from '@/lib/format'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'

interface PlanRow { id: string; nome: string; valor_semanal: number }

// Modal de fechamento (Fase 2A): escolhe o plano da venda → a comissão segue o % do plano.
// onConfirm(planoId | null): null = sem plano ativo (legado US$25/sem). onCancel: NÃO fecha a venda.
export function WonPlanModal({ leadName, onConfirm, onCancel }: {
  leadName: string
  onConfirm: (planoId: string | null) => void
  onCancel: () => void
}) {
  const supabase = createClient()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      // Planos ativos + plano ATUAL do cliente (se já existe, por nome) p/ pré-selecionar.
      const [{ data: pl }, { data: cli }] = await Promise.all([
        supabase.from('plans').select('id, nome, valor_semanal').eq('ativo', true).order('ordem'),
        supabase.from('clients').select('plano_id').ilike('name', leadName).limit(1),
      ])
      if (!alive) return
      const list = (pl ?? []) as PlanRow[]
      setPlans(list)
      const atual = (cli?.[0]?.plano_id as string | null) ?? null
      setSelected(atual ?? list[0]?.id ?? null)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [supabase, leadName])

  // Bloco 4 (a11y/UX): ESC fecha, foco preso + retornado ao abridor, scroll-lock — via useDialog
  // (substitui o listener de ESC manual). SÓ semântica/foco; nada da lógica de fechamento mudou.
  const { ref, dialogProps } = useDialog(onCancel)

  const confirm = () => { if (busy) return; setBusy(true); onConfirm(selected) }

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[300] p-0 sm:p-4"
      onClick={onCancel}>
      <div ref={ref} {...dialogProps} aria-labelledby="won-plan-title" className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-lg max-h-[92vh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-5 border-b border-bento-border">
          <Trophy className="w-5 h-5 text-lime-fg shrink-0" />
          <div className="min-w-0">
            <h2 id="won-plan-title" className="font-display font-bold text-bento-text text-base truncate">Fechar venda — {leadName}</h2>
            <p className="text-xs text-bento-muted mt-0.5">Escolha o plano desta venda.</p>
          </div>
        </div>

        <div className="p-5 overflow-auto space-y-2">
          {loading ? (
            <p className="text-sm text-bento-muted">Carregando planos...</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-bento-muted">Nenhum plano ativo — a venda será lançada no plano legado.</p>
          ) : plans.map(p => {
            const on = selected === p.id
            return (
              <button key={p.id} type="button" onClick={() => setSelected(p.id)}
                className={cn('w-full text-left rounded-bento border p-3 transition-colors',
                  on ? 'border-lime bg-lime/10' : 'border-bento-border hover:border-lime/60')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-bento-text">{p.nome}</span>
                  <span className={cn('w-4 h-4 rounded-full border flex items-center justify-center flex-none',
                    on ? 'border-lime bg-lime' : 'border-bento-border')}>
                    {on && <Check className="w-3 h-3 text-lime-ink" />}
                  </span>
                </div>
                <p className="font-tech text-[11px] text-bento-dim mt-1">{usd(p.valor_semanal)}/sem</p>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-bento-border">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-btn text-sm font-medium text-bento-dim border border-bento-border hover:border-lime transition-colors disabled:opacity-50 min-h-[44px]">
            Cancelar
          </button>
          <button type="button" onClick={confirm} disabled={busy || loading}
            className="bento-btn px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
            {busy ? 'Fechando...' : 'Fechar venda'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
