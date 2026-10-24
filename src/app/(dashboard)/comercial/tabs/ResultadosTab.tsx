'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, Clock, Download, Trophy, TrendingUp, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rangeFor, type Mode, type Range } from '@/lib/period'
import { ymd } from '@/lib/date'
import { PeriodNavigator } from '@/components/ui/PeriodNavigator'
import { MetricCard } from '@/components/ui/MetricCard'
import { Panel } from '@/components/bento/Panel'
import { AcquisitionInvestmentForm } from '@/components/dashboard/AcquisitionInvestmentForm'
import type { ReportInsight } from '@/core/reporting/types'
import { getExecutiveReportAction, type ExecReportResult } from '../followup/report-actions'

// Aba RESULTADOS (COMERCIAL-RESULTADOS-001). Junta as três telas de números que existiam — Visão Geral
// (mês fixo), Métricas (período navegável) e o Relatório que morava na Mesa — e que repetiam receita,
// conversão, ticket, funil por etapa e receita por vendedor/plano, cada uma com o seu seletor e o seu PDF.
//
// Fonte ÚNICA: getExecutiveReportAction — a mesma do PDF, então tela e PDF batem 1:1 por construção.
// ZERO cálculo de regra aqui: só formatação, razões entre números prontos e largura de barra (ARCH-001).
const MODES: [Mode, string][] = [['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre'], ['semestre', 'Semestre'], ['ano', 'Ano']]

// Lembra a UNIDADE escolhida (não a janela): reabrir no mês de duas semanas atrás confundiria. Padrão = mês.
const PERIOD_KEY = 'ed:resultados-period'
function rememberedMode(): Mode {
  try { const m = localStorage.getItem(PERIOD_KEY); return MODES.some(([v]) => v === m) ? (m as Mode) : 'mes' } catch { return 'mes' }
}

// Dólar inteiro (en-US): o MESMO formato do PDF executivo — tela e PDF lado a lado mostram igual.
const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`
const usdOrDash = (v: number | null): string => (v == null ? '—' : usd(v))   // sem denominador → "—", nunca "0"/"Infinity"
const roiX = (v: number | null): string => (v == null ? '—' : `${v.toFixed(1)}x`)
const pct = (n: number): string => `${Math.round(n * 100)}%`
// Razão entre duas etapas do funil. Denominador zero → null (0% mentiria: não houve base para converter).
const ratio = (num: number, den: number): string | null => (den > 0 ? pct(num / den) : null)

const INSIGHT_STYLE: Record<ReportInsight['kind'], { Icon: typeof Clock; cls: string }> = {
  gargalo: { Icon: Clock, cls: 'text-amber-400' },
  melhor_etapa: { Icon: Trophy, cls: 'text-emerald-400' },
  pior_etapa: { Icon: XCircle, cls: 'text-red-400' },
  no_show: { Icon: XCircle, cls: 'text-red-400' },
  queda_conversao: { Icon: TrendingUp, cls: 'text-red-400' },
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="font-tech text-label uppercase tracking-label text-bento-muted mb-2.5 px-0.5">{children}</p>
}

// Lista de barras (receita por vendedor / plano) — só apresentação; os números vêm prontos do serviço.
function BarList({ rows }: { rows: { label: string; value: number; sub: string }[] }) {
  if (rows.length === 0) return <p className="text-note text-bento-muted">Sem receita recebida no período.</p>
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-caption mb-1 gap-2">
            <span className="text-bento-text truncate">{r.label} <span className="text-bento-dim">· {r.sub}</span></span>
            <span className="font-tech text-bento-text tabular-nums shrink-0">{usd(r.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-bento-bg overflow-hidden">
            <div className="h-full bg-lime rounded-full" style={{ width: `${Math.min(100, Math.round((r.value / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ResultadosTab() {
  const [range, setRange] = useState<Range>(() => rangeFor(rememberedMode()))
  const [res, setRes] = useState<Extract<ExecReportResult, { ok: true }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [aquisicaoAberta, setAquisicaoAberta] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const selectRange = (r: Range) => {
    setRange(r)
    if (MODES.some(([m]) => m === r.mode)) {
      try { localStorage.setItem(PERIOD_KEY, r.mode) } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true); setError(null)
      const r = await getExecutiveReportAction({ fromYMD: ymd(range.start), toYMD: ymd(range.end), label: range.label })
      if (!active) return
      if (!r.ok) { setError(r.error); setRes(null) } else setRes(r)
      setLoading(false)
    })()
    return () => { active = false }
  }, [range, reloadKey])

  // Investimento lançado → relê os números (o total de Aquisição e o ROI mudam na hora).
  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  const gerarPdf = async () => {
    if (!res || pdfBusy) return
    setPdfBusy(true); setError(null)
    try {
      const { buildExecutivePdf } = await import('@/lib/commercial/executive-pdf')
      await buildExecutivePdf({ exec: res.exec, execPrev: res.execPrev, report: res.report, workspace: res.workspace, user: res.user })
    } catch {
      setError('Não foi possível gerar o PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  const exec = res?.exec
  const execPrev = res?.execPrev
  const k = res?.report.kpis
  const cmp = res?.report.comparison ?? null
  const funnel = (res?.report.funnel ?? []).filter(f => f.count > 0)
  const insights = res?.report.insights ?? []
  const maxFunnel = Math.max(1, ...funnel.map(f => f.count))
  // Sem dados (carregando OU erro) → "—". Com erro, cair no `?? 0` mostraria US$ 0 / 0% como se fossem reais.
  const semDados = loading || !res
  const dash = semDados ? '—' : undefined
  // Comparativo com o período anterior de mesma duração — trend do MetricCard: "+N vs. anterior".
  const trend = (curV: number, prevV: number | null | undefined, suffix = ''): { value: number; suffix?: string; label: string } | undefined =>
    (semDados || prevV == null) ? undefined : { value: Math.round(curV) - Math.round(prevV), suffix, label: 'vs. anterior' }
  const rate = (num: number, den: number, base: string): string | undefined => {
    if (semDados) return undefined
    const r = ratio(num, den)
    return r ? `${r} ${base}` : undefined
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-bento-bg">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Período navegável + o ÚNICO botão de PDF (mesma fonte da tela). */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PeriodNavigator range={range} onChange={selectRange} modes={MODES} />
          <button type="button" onClick={gerarPdf} disabled={pdfBusy || loading || !res}
            className="inline-flex items-center gap-2 rounded-btn border border-bento-border px-3 min-h-control text-sm font-medium text-bento-dim transition-colors hover:border-lime hover:text-bento-text disabled:opacity-50">
            <Download className="h-4 w-4" />{pdfBusy ? 'Gerando…' : 'Baixar PDF'}
          </button>
        </div>

        {error && <div className="rounded-btn border border-amber-800/40 bg-amber-900/20 px-4 py-3 text-xs text-amber-400">{error}</div>}

        {/* 1 · PONTOS DE ATENÇÃO — onde está o problema, antes dos números. */}
        {!loading && insights.length > 0 && (
          <section>
            <SectionLabel>Pontos de atenção</SectionLabel>
            <ul className="bento-fx p-3 space-y-2">
              {insights.map((ins, i) => {
                const { Icon, cls } = INSIGHT_STYLE[ins.kind]
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cls)} />
                    <span className="text-note text-bento-text leading-snug">{ins.message}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* 2 · RESULTADO DO PERÍODO — o dinheiro e quanto converteu. */}
        <section>
          <SectionLabel>Resultado · {range.label}</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <MetricCard title="Receita recebida" value={dash ?? usd(exec?.receitaRecebida ?? 0)} size="lg" tone="emerald"
              subtitle="pagamentos no período" trend={trend(exec?.receitaRecebida ?? 0, execPrev?.receitaRecebida)} />
            <MetricCard title="Valor fechado" value={dash ?? usd(exec?.valorFechado ?? 0)} size="lg"
              subtitle="contratos assinados" trend={trend(exec?.valorFechado ?? 0, execPrev?.valorFechado)} />
            <MetricCard title="Ticket médio" value={dash ?? usd(exec?.ticketMedio ?? 0)} size="lg" tone="blue"
              subtitle="por venda" trend={trend(exec?.ticketMedio ?? 0, execPrev?.ticketMedio)} />
            <MetricCard title="Conversão" value={dash ?? pct(k?.conversionRate ?? 0)} size="lg" tone="emerald"
              subtitle="vendas ÷ leads recebidos"
              trend={trend((k?.conversionRate ?? 0) * 100, cmp ? cmp.conversionRate * 100 : null, 'pp')} />
          </div>
        </section>

        {/* 3 · CARTEIRA — foto de agora (não depende do período), mais o que está para entrar. */}
        <section>
          <SectionLabel>Carteira atual</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <MetricCard title="MRR" value={dash ?? usd(exec?.mrr ?? 0)} size="sm" tone="positive" subtitle="receita mensal recorrente" />
            <MetricCard title="ARR" value={dash ?? usd(exec?.arr ?? 0)} size="sm" subtitle="MRR × 12" />
            <MetricCard title="Receita prevista" value={dash ?? usd(exec?.receitaPrevista ?? 0)} size="sm" subtitle="a receber até o fim do período" />
            <MetricCard title="Clientes ativos" value={dash ?? (exec?.clientesAtivos ?? 0)} size="sm" subtitle="carteira total" />
            <MetricCard title="Clientes novos" value={dash ?? (exec?.clientesNovos ?? 0)} size="sm"
              tone={(exec?.clientesNovos ?? 0) > 0 ? 'positive' : 'default'} subtitle="entraram no período" />
          </div>
        </section>

        {/* 4 · FUNIL DO PERÍODO — o que foi feito, com a taxa de cada degrau no subtítulo. */}
        <section>
          <SectionLabel>Funil do período · {range.label}</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <MetricCard title="Leads recebidos" value={dash ?? (k?.newLeads ?? 0)} size="sm"
              subtitle="entraram no período" trend={trend(k?.newLeads ?? 0, cmp?.newLeads)} />
            <MetricCard title="Interagiram" value={dash ?? (k?.interagiram ?? 0)} size="sm"
              subtitle={rate(k?.interagiram ?? 0, k?.newLeads ?? 0, 'dos recebidos')} trend={trend(k?.interagiram ?? 0, cmp?.interagiram)} />
            <MetricCard title="Reuniões marcadas" value={dash ?? (k?.meetingsScheduled ?? 0)} size="sm"
              trend={trend(k?.meetingsScheduled ?? 0, cmp?.meetingsScheduled)} />
            <MetricCard title="Reuniões realizadas" value={dash ?? (k?.meetingsHeld ?? 0)} size="sm"
              subtitle={rate(k?.meetingsHeld ?? 0, k?.meetingsScheduled ?? 0, 'das marcadas')} trend={trend(k?.meetingsHeld ?? 0, cmp?.meetingsHeld)} />
            <MetricCard title="Propostas" value={dash ?? (k?.proposals ?? 0)} size="sm"
              trend={trend(k?.proposals ?? 0, cmp?.proposals)} />
            <MetricCard title="Vendas" value={dash ?? (k?.won ?? 0)} size="sm" tone="positive"
              subtitle={rate(k?.won ?? 0, k?.meetingsHeld ?? 0, 'das realizadas')} trend={trend(k?.won ?? 0, cmp?.won)} />
          </div>
        </section>

        {/* 5 · PERDAS E ATRASOS — o que escapou no período. Cartões pequenos, tom neutro. */}
        <section>
          <SectionLabel>Perdas e atrasos · {range.label}</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <MetricCard title="Não interagiram" value={dash ?? (k?.naoInteragiram ?? 0)} size="sm" tone="muted" />
            <MetricCard title="No-show" value={dash ?? (k?.noShow ?? 0)} size="sm" tone="muted" />
            <MetricCard title="Vendas perdidas" value={dash ?? (k?.lost ?? 0)} size="sm" tone="muted" />
            <MetricCard title="Negócios futuros" value={dash ?? (k?.negociosFuturos ?? 0)} size="sm" tone="muted" />
            <MetricCard title="Reagendamentos" value={dash ?? (k?.reagendamentos ?? 0)} size="sm" tone="muted" />
          </div>
        </section>

        {/* 6 · FUNIL POR ETAPA — onde os leads estão parados AGORA (fases reais, gargalo = a maior). */}
        {!loading && funnel.length > 0 && (
          <section>
            <SectionLabel>Funil por etapa · agora</SectionLabel>
            <div className="bento-fx p-4 space-y-2.5">
              {funnel.map((f, i) => (
                <div key={f.stage}>
                  <div className="flex items-center justify-between text-caption mb-1 gap-2">
                    <span className="text-bento-text truncate">
                      {f.stage}{i === 0 && <span className="ml-2 font-tech text-label uppercase tracking-label text-amber-400">gargalo</span>}
                    </span>
                    <span className="text-bento-muted shrink-0 tabular-nums">{f.count}{f.avgDays != null ? ` · ${f.avgDays}d em média` : ''}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bento-bg overflow-hidden">
                    <div className={cn('h-full rounded-full', i === 0 ? 'bg-amber-400' : 'bg-lime')} style={{ width: `${Math.round((f.count / maxFunnel) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7 · RECEITA POR VENDEDOR / PLANO — recebida no período. */}
        {!loading && exec && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Panel label={`Receita por vendedor · ${range.label}`}>
              <BarList rows={exec.receitaPorVendedor.map(s => ({ label: s.name, value: s.value, sub: `${s.count} cliente(s)` }))} />
            </Panel>
            <Panel label={`Receita por plano · ${range.label}`}>
              <BarList rows={exec.receitaPorPlano.map(p => ({ label: p.plan, value: p.value, sub: `${p.count} cliente(s)` }))} />
            </Panel>
          </div>
        )}

        {/* 8 · AQUISIÇÃO — custo de marketing. Recolhida: é consulta eventual, e o lançamento mora aqui. */}
        <section className="bento-fx overflow-hidden">
          <button type="button" onClick={() => setAquisicaoAberta(v => !v)} aria-expanded={aquisicaoAberta}
            className="flex w-full items-center gap-3 px-4 py-3 text-left min-h-control">
            <span className="flex-1 min-w-0">
              <span className="block font-tech text-label uppercase tracking-label text-bento-muted">Aquisição · {range.label}</span>
              {!aquisicaoAberta && exec && (
                <span className="block text-caption text-bento-dim mt-0.5">
                  Investimento {usd(exec.investimento)} · ROI {roiX(exec.roi)}
                </span>
              )}
            </span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-bento-muted transition-transform', aquisicaoAberta && 'rotate-180')} />
          </button>
          {aquisicaoAberta && (
            <div className="border-t border-bento-border px-4 pb-4 pt-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <MetricCard title="Investimento" value={dash ?? usd(exec?.investimento ?? 0)} tone="muted" size="sm" />
                <MetricCard title="Custo por lead" value={dash ?? usdOrDash(exec?.cpl ?? null)} tone="muted" size="sm" />
                <MetricCard title="Custo por reunião" value={dash ?? usdOrDash(exec?.custoPorReuniao ?? null)} tone="muted" size="sm" />
                <MetricCard title="Custo por venda" value={dash ?? usdOrDash(exec?.custoPorVenda ?? null)} tone="muted" size="sm" />
                <MetricCard title="ROI" value={dash ?? roiX(exec?.roi ?? null)} tone="muted" size="sm" />
              </div>
              <AcquisitionInvestmentForm onSaved={reload} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
