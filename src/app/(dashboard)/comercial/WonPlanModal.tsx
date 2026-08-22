'use client'

import { useEffect, useState } from 'react'
import { Trophy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { usd } from '@/lib/format'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'

interface PlanRow { id: string; nome: string; valor_semanal: number; comissao_percentual: number | null }

// Modal de fechamento (Fase 2A): escolhe o plano da venda → a comissão segue o % do plano.
// onConfirm(planoId | null, customWeeklyUsd | null): planoId null + custom preenchido = PLANO AVULSO.
// onCancel: NÃO fecha a venda.
//
// AVULSO (PLANO-AVULSO-001): valor semanal digitado na hora, válido só para ESTA venda. Não vira linha em
// `plans` — logo não aparece na lista da próxima vez, não afeta nenhum outro cliente e não muda o catálogo.
// O cliente nasce com plano_id null e plan_weekly = valor digitado; resolveClientPlan já lê exatamente assim
// (plano_id null → usa plan_weekly), então cobrança semanal, agendador e receita funcionam igual aos demais.
// A comissão segue o MESMO padrão: % do catálogo (20%) sobre o valor semanal, nas 4 primeiras semanas.
export function WonPlanModal({ leadName, onConfirm, onCancel }: {
  leadName: string
  onConfirm: (planoId: string | null, customWeeklyUsd: number | null) => void
  onCancel: () => void
}) {
  const supabase = createClient()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [custom, setCustom] = useState(false)          // "Personalizado" escolhido
  const [customValue, setCustomValue] = useState('')   // valor semanal digitado (USD)
  const [pct, setPct] = useState(20)                   // % do catálogo, só p/ mostrar a comissão prevista
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      // Planos ativos + plano ATUAL do cliente (se já existe, por nome) p/ pré-selecionar.
      const [{ data: pl }, { data: cli }] = await Promise.all([
        supabase.from('plans').select('id, nome, valor_semanal, comissao_percentual').eq('ativo', true).order('ordem'),
        supabase.from('clients').select('plano_id').ilike('name', leadName).limit(1),
      ])
      if (!alive) return
      const list = (pl ?? []) as PlanRow[]
      setPlans(list)
      // % padrão do catálogo (todos os planos usam o mesmo hoje): só para o preview da comissão.
      const catalogoPct = list.map(x => Number(x.comissao_percentual)).find(x => Number.isFinite(x) && x > 0)
      if (catalogoPct) setPct(catalogoPct)
      const atual = (cli?.[0]?.plano_id as string | null) ?? null
      setSelected(atual ?? list[0]?.id ?? null)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [supabase, leadName])

  // Bloco 4 (a11y/UX): ESC fecha, foco preso + retornado ao abridor, scroll-lock — via useDialog
  // (substitui o listener de ESC manual). SÓ semântica/foco; nada da lógica de fechamento mudou.
  const { ref, dialogProps } = useDialog(onCancel)

  const customNum = Number(String(customValue).replace(',', '.'))
  const customOk = Number.isFinite(customNum) && customNum > 0
  const podeConfirmar = custom ? customOk : true

  const confirm = () => {
    if (busy || !podeConfirmar) return
    setBusy(true)
    if (custom) onConfirm(null, Math.round(customNum * 100) / 100)
    else onConfirm(selected, null)
  }

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[300] p-0 sm:p-4"
      onClick={onCancel}>
      <div ref={ref} {...dialogProps} aria-labelledby="won-plan-title" className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-lg max-h-[92dvh] flex flex-col overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-2 p-5 border-b border-bento-border">
          <Trophy className="w-5 h-5 text-lime-fg shrink-0" />
          <div className="min-w-0">
            <h2 id="won-plan-title" className="font-display font-bold text-bento-text text-base truncate">Fechar venda — {leadName}</h2>
            <p className="text-xs text-bento-muted mt-0.5">Escolha o plano desta venda.</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-5 overflow-y-auto overscroll-contain space-y-2">
          {loading ? (
            <p className="text-sm text-bento-muted">Carregando planos...</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-bento-muted">Nenhum plano ativo — a venda será lançada no plano legado.</p>
          ) : plans.map(p => {
            const on = !custom && selected === p.id
            return (
              <button key={p.id} type="button" onClick={() => { setSelected(p.id); setCustom(false) }}
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

          {/* PLANO AVULSO — valor só desta venda; não entra no catálogo. */}
          {!loading && (
            <div className={cn('rounded-bento border transition-colors',
              custom ? 'border-lime bg-lime/10' : 'border-bento-border hover:border-lime/60')}>
              <button type="button" onClick={() => setCustom(true)} className="w-full text-left p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-bento-text">Personalizado</span>
                  <span className={cn('w-4 h-4 rounded-full border flex items-center justify-center flex-none',
                    custom ? 'border-lime bg-lime' : 'border-bento-border')}>
                    {custom && <Check className="w-3 h-3 text-lime-ink" />}
                  </span>
                </div>
                <p className="font-tech text-[11px] text-bento-dim mt-1">Valor avulso, só para esta venda</p>
              </button>
              {custom && (
                <div className="px-3 pb-3 space-y-2">
                  <label className="block">
                    <span className="font-tech text-[10px] uppercase tracking-label text-bento-muted">Valor semanal (USD)</span>
                    <input type="number" min="0" step="0.01" inputMode="decimal" autoFocus
                      value={customValue} onChange={e => setCustomValue(e.target.value)}
                      placeholder="Ex.: 165"
                      className="mt-1 w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime" />
                  </label>
                  {customOk ? (
                    <p className="font-tech text-[11px] text-bento-dim">
                      {usd(customNum)}/sem · comissão {pct}% = {usd(Math.round(customNum * pct) / 100)}/sem nas 4 primeiras semanas
                      {' '}(total {usd(Math.round(customNum * pct * 4) / 100)})
                    </p>
                  ) : (
                    <p className="font-tech text-[11px] text-amber-300">Informe um valor semanal maior que zero.</p>
                  )}
                  <p className="text-[11px] text-bento-muted">Este valor vale só para {leadName}. O catálogo de planos não muda.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-bento-border px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-btn text-sm font-medium text-bento-dim border border-bento-border hover:border-lime transition-colors disabled:opacity-50 min-h-[44px]">
            Cancelar
          </button>
          <button type="button" onClick={confirm} disabled={busy || loading || !podeConfirmar}
            className="bento-btn px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
            {busy ? 'Fechando…' : 'Fechar venda'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
