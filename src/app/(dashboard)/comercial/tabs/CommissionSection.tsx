'use client'

// Módulo de Comissão — Tela, Bloco 1: Configuração + Resumo do mês.
// Mora dentro do perfil do vendedor (sub-tab "Comissão"). Usa SÓ as tabelas da
// migration 017 (fx_config, seller_salaries, deals, weekly_payments, meetings) e
// as funções puras de src/lib/commission/calc. Moeda real = USD; BRL é exibição.
// NÃO faz lançamento de venda/semana/reunião (bloco 2) nem histórico (bloco 3).

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Lock, Unlock, Wallet, DollarSign, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSave } from '@/lib/useSave'
import { cn } from '@/lib/utils'
import { monthlySummary, resolveRate } from '@/lib/commission/calc'
import type { SalaryPeriod, Meeting, WeeklyPayment, FxConfig } from '@/lib/commission/types'

const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

const pad2 = (n: number) => String(n).padStart(2, '0')
const usd = (n: number) => `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const monthName = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const fmtMonthYear = (iso: string) => { const [y, m] = iso.split('-'); return `${m}/${y}` }

export function CommissionSection({ sellerId }: { sellerId: string }) {
  const save = useSave()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [salaries, setSalaries] = useState<SalaryPeriod[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [weeks, setWeeks] = useState<WeeklyPayment[]>([])

  // Cotação salva (global)
  const [fxManual, setFxManual] = useState<number | null>(null)
  const [fxTravada, setFxTravada] = useState(false)
  // Cotação em edição
  const [fxManualInput, setFxManualInput] = useState('')
  const [fxTravadaInput, setFxTravadaInput] = useState(false)
  const [savingFx, setSavingFx] = useState(false)
  const [fxError, setFxError] = useState('')

  // Mês em foco no resumo
  const now = new Date()
  const [refDate, setRefDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const prevMonth = () => setRefDate(r => r.month === 1 ? { year: r.year - 1, month: 12 } : { year: r.year, month: r.month - 1 })
  const nextMonth = () => setRefDate(r => r.month === 12 ? { year: r.year + 1, month: 1 } : { year: r.year, month: r.month + 1 })

  // Form de salário (novo período de vigência)
  const [salValor, setSalValor] = useState('')
  const [salMonth, setSalMonth] = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`)
  const [savingSal, setSavingSal] = useState(false)
  const [salError, setSalError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [salRes, mtgRes, dealRes, fxRes] = await Promise.all([
      supabase.from('seller_salaries').select('seller_id, valor_usd, effective_from').eq('seller_id', sellerId).order('effective_from', { ascending: false }),
      supabase.from('meetings').select('id, seller_id, met_on, valor_usd, cotacao_usd_brl').eq('seller_id', sellerId),
      supabase.from('deals').select('id').eq('seller_id', sellerId),
      supabase.from('fx_config').select('cotacao_manual, cotacao_travada').eq('id', 1).maybeSingle(),
    ])

    setSalaries((salRes.data ?? []).map(s => ({ sellerId: s.seller_id, valorUsd: Number(s.valor_usd), effectiveFrom: s.effective_from })))
    setMeetings((mtgRes.data ?? []).map(m => ({ id: m.id, sellerId: m.seller_id, metOn: m.met_on, valorUsd: Number(m.valor_usd), cotacaoUsdBrl: Number(m.cotacao_usd_brl) })))

    const dealIds = (dealRes.data ?? []).map(d => d.id)
    if (dealIds.length) {
      const { data: wk } = await supabase.from('weekly_payments').select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').in('deal_id', dealIds)
      setWeeks((wk ?? []).map(w => ({ id: w.id, dealId: w.deal_id, numeroSemana: w.numero_semana, valorUsd: Number(w.valor_usd), paidOn: w.paid_on, cotacaoUsdBrl: Number(w.cotacao_usd_brl) })))
    } else {
      setWeeks([])
    }

    const m = fxRes.data?.cotacao_manual != null ? Number(fxRes.data.cotacao_manual) : null
    const t = !!fxRes.data?.cotacao_travada
    setFxManual(m); setFxTravada(t)
    setFxManualInput(m != null ? String(m) : ''); setFxTravadaInput(t)

    setLoading(false)
  }, [sellerId, supabase])

  useEffect(() => { load() }, [load])

  // ── Cálculo do mês em foco (funções puras da Fase 1) ──────────────────────
  const fx: FxConfig = { cotacaoManual: fxManual, cotacaoTravada: fxTravada }
  const automaticRate = fxManual ?? 0 // busca do dólar do dia vem depois; por ora usa o manual como referência
  const summary = monthlySummary({ year: refDate.year, month: refDate.month, salaries, meetings, weeks, fx, automaticRate })
  const appliedEff = (() => {
    const firstDay = `${refDate.year}-${pad2(refDate.month)}-01`
    return salaries.filter(s => s.effectiveFrom <= firstDay).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0]?.effectiveFrom
  })()
  const vazio = summary.totalUsd === 0

  // ── Salvar cotação (global) ───────────────────────────────────────────────
  const saveFx = async () => {
    setFxError('')
    const manualNum = fxManualInput.trim() === '' ? null : parseFloat(fxManualInput)
    if (fxManualInput.trim() !== '' && (isNaN(manualNum as number) || (manualNum as number) <= 0)) { setFxError('Cotação manual inválida.'); return }
    if (fxTravadaInput && manualNum == null) { setFxError('Pra travar, defina um valor manual.'); return }
    setSavingFx(true)
    const prevM = fxManual, prevT = fxTravada
    await save({
      optimistic: () => { setFxManual(manualNum); setFxTravada(fxTravadaInput) },
      run: () => supabase.from('fx_config').update({ cotacao_manual: manualNum, cotacao_travada: fxTravadaInput, updated_at: new Date().toISOString() }).eq('id', 1),
      rollback: () => { setFxManual(prevM); setFxTravada(prevT) },
      success: 'Cotação atualizada.',
      error: 'Não foi possível salvar a cotação',
    })
    setSavingFx(false)
  }

  // ── Adicionar salário (novo período; nunca reescreve o passado) ───────────
  const addSalary = async () => {
    setSalError('')
    const v = parseFloat(salValor)
    if (!salValor.trim() || isNaN(v) || v < 0) { setSalError('Informe um salário válido em USD.'); return }
    if (!salMonth) { setSalError('Escolha o mês de vigência.'); return }
    const effFrom = `${salMonth}-01`
    if (salaries.some(s => s.effectiveFrom === effFrom)) { setSalError('Já existe um salário com vigência nesse mês.'); return }
    setSavingSal(true)
    const { ok, data } = await save<{ seller_id: string; valor_usd: number; effective_from: string }>({
      run: () => supabase.from('seller_salaries').insert({ seller_id: sellerId, valor_usd: v, effective_from: effFrom }).select('seller_id, valor_usd, effective_from').single(),
      success: `Salário de ${usd(v)} a partir de ${fmtMonthYear(effFrom)}.`,
      error: 'Não foi possível salvar o salário',
    })
    if (ok && data) {
      setSalaries(prev => [{ sellerId: data.seller_id, valorUsd: Number(data.valor_usd), effectiveFrom: data.effective_from }, ...prev]
        .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1)))
      setSalValor('')
    }
    setSavingSal(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-10 text-bento-muted text-sm gap-2"><span className="w-4 h-4 border-2 border-bento-muted/20 border-t-lime rounded-full animate-spin" />Carregando comissão...</div>
  }

  return (
    <div className="space-y-5">
      {/* ── RESUMO DO MÊS ─────────────────────────────────────────────── */}
      <section className="bento-fx p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-bento-text"><Wallet className="w-4 h-4 text-lime-fg" /> Resumo do mês</h4>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1 rounded-btn text-bento-muted hover:text-bento-text hover:bg-bento-bg" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-medium text-bento-text capitalize min-w-[7.5rem] text-center tabular-nums">{monthName(refDate.year, refDate.month)}</span>
            <button onClick={nextMonth} className="p-1 rounded-btn text-bento-muted hover:text-bento-text hover:bg-bento-bg" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="space-y-0.5">
          {[
            { label: 'Salário fixo', u: summary.salaryUsd, b: summary.salaryBrl },
            { label: `Reuniões (${summary.meetingsCount})`, u: summary.meetingsUsd, b: summary.meetingsBrl },
            { label: `Vendas (${summary.weeksCount} sem.)`, u: summary.weeksUsd, b: summary.weeksBrl },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-2 border-b border-bento-border/40">
              <span className="text-xs text-bento-muted">{r.label}</span>
              <div className="text-right">
                <p className="text-sm font-medium text-bento-text tabular-nums">{usd(r.u)}</p>
                <p className="text-[11px] text-bento-muted tabular-nums">{brl(r.b)}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2.5">
            <span className="text-sm font-semibold text-bento-text">Total</span>
            <div className="text-right">
              <p className="text-base font-bold text-lime-fg tabular-nums">{usd(summary.totalUsd)}</p>
              <p className="text-xs text-bento-muted tabular-nums">{brl(summary.totalBrl)}</p>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-bento-muted pt-1 border-t border-bento-border/40">
          {vazio
            ? 'Sem lançamentos neste mês ainda — os valores aparecem aqui conforme você registrar reuniões e semanas (bloco 2).'
            : `Convertido a R$ ${summary.rateUsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${fxTravada ? 'travada' : 'automática'}). Reuniões e vendas usam a cotação congelada de cada lançamento.`}
        </p>
      </section>

      {/* ── CONFIGURAÇÃO: SALÁRIO ─────────────────────────────────────── */}
      <section className="bento-fx p-4 space-y-3">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-bento-text"><DollarSign className="w-4 h-4 text-lime-fg" /> Salário fixo (USD)</h4>
        <p className="text-[11px] text-bento-muted -mt-1">Cada mudança vira um novo registro com data de vigência. Aumento vale só pra frente — meses passados não são reescritos.</p>

        {salaries.length > 0 ? (
          <div className="space-y-1.5">
            {salaries.map(s => (
              <div key={s.effectiveFrom} className="flex items-center justify-between bg-bento-bg border border-bento-border/60 rounded-btn px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-bento-muted tabular-nums">a partir de {fmtMonthYear(s.effectiveFrom)}</span>
                  {s.effectiveFrom === appliedEff && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime/15 text-lime-fg border border-lime/30">vigente neste mês</span>}
                </div>
                <span className="text-sm font-medium text-bento-text tabular-nums">{usd(s.valorUsd)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-bento-muted py-2">Nenhum salário definido ainda.</p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Valor (USD)</label>
            <input type="number" value={salValor} onChange={e => setSalValor(e.target.value)} className={inputCls} placeholder="500.00" min="0" step="50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">A partir de</label>
            <input type="month" value={salMonth} onChange={e => setSalMonth(e.target.value)} className={inputCls} />
          </div>
        </div>
        {salError && <p className="text-xs text-red-400">{salError}</p>}
        <button onClick={addSalary} disabled={savingSal} className="flex items-center justify-center gap-1.5 w-full bento-btn py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          <Plus className="w-4 h-4" /> {savingSal ? 'Salvando...' : 'Definir salário'}
        </button>
      </section>

      {/* ── CONFIGURAÇÃO: COTAÇÃO ─────────────────────────────────────── */}
      <section className="bento-fx p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-bento-text"><RefreshCw className="w-4 h-4 text-lime-fg" /> Cotação USD → BRL</h4>
          <span className="text-[10px] text-bento-muted">global · vale pra todos</span>
        </div>

        <div className="flex items-center justify-between bg-bento-bg border border-bento-border/60 rounded-btn px-3 py-2.5">
          <span className="text-xs text-bento-muted">Cotação em uso</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bento-text tabular-nums">R$ {resolveRate(fx, automaticRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', fxTravada ? 'bg-amber-900/30 text-amber-400 border-amber-800/50' : 'bg-lime/15 text-lime-fg border-lime/30')}>
              {fxTravada ? 'Travada' : 'Automática'}
            </span>
          </div>
        </div>

        <button onClick={() => setFxTravadaInput(v => !v)}
          className={cn('flex items-center gap-2 w-full px-3 py-2.5 rounded-btn text-sm font-medium border transition-colors min-h-[44px]',
            fxTravadaInput ? 'border-amber-800/50 text-amber-400' : 'border-bento-border text-bento-dim hover:border-lime')}>
          {fxTravadaInput ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          {fxTravadaInput ? 'Valor manual travado' : 'Automática (usa o valor manual por enquanto)'}
        </button>

        <div>
          <label className="block text-xs font-medium text-bento-dim mb-1">Valor manual (R$ por US$1)</label>
          <input type="number" value={fxManualInput} onChange={e => setFxManualInput(e.target.value)} className={inputCls} placeholder="5.40" min="0" step="0.01" />
        </div>
        {fxError && <p className="text-xs text-red-400">{fxError}</p>}
        <p className="text-[11px] text-bento-muted">A busca do dólar do dia entra numa fase futura. Por ora, defina o valor manual e escolha travar ou deixar automática.</p>
        <button onClick={saveFx} disabled={savingFx} className="w-full bento-btn py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          {savingFx ? 'Salvando...' : 'Salvar cotação'}
        </button>
      </section>
    </div>
  )
}
