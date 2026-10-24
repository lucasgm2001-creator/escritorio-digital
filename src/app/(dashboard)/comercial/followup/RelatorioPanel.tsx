'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Download, Clock, Trophy, XCircle, TrendingUp } from 'lucide-react'
import { rangeFor, type Mode, type Range } from '@/lib/period'
import { PeriodNavigator } from '@/components/ui/PeriodNavigator'
import { getExecutiveReportAction, type ExecReportResult } from './report-actions'
import { MetricCard } from '@/components/ui/MetricCard'
import type { ReportInsight } from '@/core/reporting/types'

// Relatório — Resumo executivo (EXECUTIVE-METRICS-004). NÃO calcula nem consulta o banco: puxa o mesmo
// { exec, report } do PDF via getExecutiveReportAction (exec = ExecutiveMetricsService, fonte única; report =
// ReportingService, funil/insights). Tela e PDF batem 1:1. Sem DashboardVM antigo, sem métrica all-time.

const REPORT_MODES: [Mode, string][] = [['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre'], ['semestre', 'Semestre'], ['ano', 'Ano']]
const pct = (n: number): string => `${Math.round(n * 100)}%`
// Razão entre duas etapas do funil. Denominador zero → '—' (0% mentiria: não houve base para converter).
const ratio = (num: number, den: number): string => (den > 0 ? pct(num / den) : '—')
// Lembra a última escolha de período (preset) — SMART-WORKFLOW-001. Só UI/client (localStorage): sem
// servidor/dado/regra. Valor ausente ou inválido cai no padrão seguro 'semana'. Janela custom não é lembrada.
const PERIOD_KEY = 'ed:report-period'
function rememberedMode(): Mode {
  try { const m = localStorage.getItem(PERIOD_KEY); return REPORT_MODES.some(([v]) => v === m) ? (m as Mode) : 'semana' } catch { return 'semana' }
}
const usd = (n: number): string => `US$ ${Math.round(n).toLocaleString('en-US')}`
const toYmd = (d: Date): string => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

const INSIGHT_STYLE: Record<ReportInsight['kind'], { Icon: typeof Clock; cls: string }> = {
  gargalo: { Icon: Clock, cls: 'text-amber-400' },
  melhor_etapa: { Icon: Trophy, cls: 'text-emerald-400' },
  pior_etapa: { Icon: XCircle, cls: 'text-red-400' },
  no_show: { Icon: XCircle, cls: 'text-red-400' },
  queda_conversao: { Icon: TrendingUp, cls: 'text-red-400' },
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="font-tech text-[10px] uppercase tracking-[0.18em] text-bento-muted mb-2.5 px-0.5">{children}</p>
}

function ListPanel({ title, rows }: { title: string; rows: { label: string; value: number; sub: string }[] }) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="bento-fx p-3 space-y-1.5">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="text-bento-text truncate">{r.label} <span className="text-bento-dim">· {r.sub}</span></span>
            <span className="font-tech text-bento-text tabular-nums shrink-0">{usd(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RelatorioPanel() {
  const [range, setRange] = useState<Range>(() => rangeFor(rememberedMode()))   // padrão: última escolha (ou semana)
  const [res, setRes] = useState<Extract<ExecReportResult, { ok: true }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  // O PeriodNavigator concentra presets, setas e janela personalizada. Aqui só persistimos a UNIDADE
  // escolhida (não a janela): reabrir no mesmo mês de duas semanas atrás confundiria mais do que ajudaria.
  const selectRange = (r: Range) => {
    setRange(r)
    if (REPORT_MODES.some(([m]) => m === r.mode)) {
      try { localStorage.setItem(PERIOD_KEY, r.mode) } catch { /* ignore */ }
    }
  }

  // Carrega o relatório (mesma fonte do PDF) sempre que a janela muda.
  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true); setError(null)
      const r = await getExecutiveReportAction({ fromYMD: toYmd(range.start), toYMD: toYmd(range.end), label: range.label })
      if (!active) return
      if (!r.ok) { setError(r.error); setRes(null) } else setRes(r)
      setLoading(false)
    })()
    return () => { active = false }
  }, [range])

  const gerarPdf = async () => {
    if (!res) return
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
  const porVendedor = exec?.receitaPorVendedor ?? []
  const porPlano = exec?.receitaPorPlano ?? []
  const maxFunnel = Math.max(1, ...funnel.map(f => f.count))
  const dash = loading ? '—' : undefined
  // Comparativo com o período anterior (Parte 4) — trend do MetricCard: "+N vs. anterior".
  const trend = (curV: number, prevV: number | null | undefined, suffix = ''): { value: number; suffix?: string; label: string } | undefined =>
    (loading || prevV == null) ? undefined : { value: Math.round(curV) - Math.round(prevV), suffix, label: 'vs. anterior' }

  return (
    <div className="space-y-5">
      {/* Cabeçalho + PDF */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-tech text-[10px] uppercase tracking-[0.22em] text-bento-muted">DR Growth · Comercial</p>
          <h2 className="font-display font-bold text-bento-text text-lg mt-1">Relatório — Resumo</h2>
        </div>
        <button onClick={gerarPdf} disabled={pdfBusy || loading || !res}
          className="flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-btn text-sm font-medium border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50">
          <Download className="w-4 h-4" />{pdfBusy ? 'Gerando...' : 'Baixar PDF'}
        </button>
      </div>

      {/* Período NAVEGÁVEL (setas ← →) + unidade + janela personalizada — mesmo componente da aba Métricas. */}
      <PeriodNavigator range={range} onChange={selectRange} modes={REPORT_MODES} />

      {error && <div className="bg-amber-900/20 border border-amber-800/40 rounded-btn px-4 py-3 text-xs text-amber-400">{error}</div>}

      {/* ── ESSENCIAL — a leitura de 10 segundos (RELATORIO-DUAS-CAMADAS-001) ──────────────────────
          Antes o relatório abria com cinco contagens de movimentação e o julgamento ficava por conta do
          leitor. Estas seis respondem "como foi o período?" sem precisar de conta na cabeça: volume de
          entrada, a eficiência de cada degrau do funil e o dinheiro médio por venda. O detalhamento
          continua logo abaixo, inteiro. */}
      <section>
        <SectionLabel>Essencial · {range.label}</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          <MetricCard title="Leads recebidos" value={dash ?? (k?.newLeads ?? 0)} size="sm"
            subtitle="entradas no período" trend={trend(k?.newLeads ?? 0, cmp?.newLeads)} />
          <MetricCard title="Taxa de interação" value={dash ?? ratio(k?.interagiram ?? 0, k?.newLeads ?? 0)} size="sm"
            subtitle="interagiram ÷ recebidos" />
          <MetricCard title="Reunião marcada → realizada" value={dash ?? ratio(k?.meetingsHeld ?? 0, k?.meetingsScheduled ?? 0)} size="sm"
            subtitle={`${k?.meetingsHeld ?? 0} de ${k?.meetingsScheduled ?? 0}`} />
          <MetricCard title="Reunião → venda" value={dash ?? ratio(k?.won ?? 0, k?.meetingsHeld ?? 0)} size="sm"
            subtitle={`${k?.won ?? 0} de ${k?.meetingsHeld ?? 0} realizadas`} tone="positive" />
          <MetricCard title="Taxa de conversão" value={dash ?? pct(k?.conversionRate ?? 0)} size="sm"
            subtitle="vendas ÷ leads recebidos" tone="emerald"
            trend={trend((k?.conversionRate ?? 0) * 100, (cmp?.conversionRate ?? 0) * 100, 'pp')} />
          <MetricCard title="Ticket médio" value={dash ?? usd(exec?.ticketMedio ?? 0)} size="sm"
            subtitle="por venda no período" tone="blue" />
        </div>
      </section>

      <SectionLabel>Detalhamento</SectionLabel>

      {/* Funil do período por movimentações reais. trend = Δ vs. período anterior de mesma duração. */}
      <section>
        <SectionLabel>Funil do período (movimentações) · {range.label}</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <MetricCard title="Leads recebidos" value={dash ?? (k?.newLeads ?? 0)} size="sm" trend={trend(k?.newLeads ?? 0, cmp?.newLeads)} />
          <MetricCard title="Interagiram" value={dash ?? (k?.interagiram ?? 0)} size="sm" trend={trend(k?.interagiram ?? 0, cmp?.interagiram)} />
          <MetricCard title="Reuniões marcadas" value={dash ?? (k?.meetingsScheduled ?? 0)} size="sm" trend={trend(k?.meetingsScheduled ?? 0, cmp?.meetingsScheduled)} />
          <MetricCard title="Propostas em análise" value={dash ?? (k?.proposals ?? 0)} size="sm" trend={trend(k?.proposals ?? 0, cmp?.proposals)} />
          <MetricCard title="Vendas concluídas" value={dash ?? (k?.won ?? 0)} size="sm" tone="positive" trend={trend(k?.won ?? 0, cmp?.won)} />
        </div>
      </section>

      {/* Secundárias do período (menores, baixa prioridade). */}
      <section>
        <SectionLabel>Secundárias · {range.label}</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <MetricCard title="Não interagiram" value={dash ?? (k?.naoInteragiram ?? 0)} size="sm" tone="muted" />
          <MetricCard title="No-show" value={dash ?? (k?.noShow ?? 0)} size="sm" tone="muted" />
          <MetricCard title="Vendas perdidas" value={dash ?? (k?.lost ?? 0)} size="sm" tone="muted" />
          <MetricCard title="Negócios futuros" value={dash ?? (k?.negociosFuturos ?? 0)} size="sm" tone="muted" />
          <MetricCard title="Reagendamentos" value={dash ?? (k?.reagendamentos ?? 0)} size="sm" tone="muted" />
        </div>
      </section>

      {/* Receita DO PERÍODO (dinheiro real da janela) — SEM carteira. trend = Δ vs. período anterior. */}
      <section>
        <SectionLabel>Receita · {range.label}</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <MetricCard title="Receita Recebida" value={dash ?? usd(exec?.receitaRecebida ?? 0)} size="sm" tone="emerald" trend={trend(exec?.receitaRecebida ?? 0, execPrev?.receitaRecebida)} />
          <MetricCard title="Receita Prevista" value={dash ?? usd(exec?.receitaPrevista ?? 0)} size="sm" />
          <MetricCard title="Valor Fechado" value={dash ?? usd(exec?.valorFechado ?? 0)} size="sm" />
          <MetricCard title="Ticket Médio" value={dash ?? usd(exec?.ticketMedio ?? 0)} size="sm" />
          <MetricCard title="Conversão" value={dash ?? `${Math.round((k?.conversionRate ?? 0) * 100)}%`} size="sm" trend={trend((k?.conversionRate ?? 0) * 100, (cmp?.conversionRate ?? 0) * 100, 'pp')} />
        </div>
      </section>

      {/* Receita por vendedor / plano — DO PERÍODO (mesma fonte do PDF: clientes pagos na janela). */}
      {!loading && (porVendedor.length > 0 || porPlano.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {porVendedor.length > 0 && <ListPanel title={`Receita por vendedor · ${range.label}`} rows={porVendedor.map(s => ({ label: s.name, value: s.value, sub: `${s.count} cliente(s)` }))} />}
          {porPlano.length > 0 && <ListPanel title={`Receita por plano · ${range.label}`} rows={porPlano.map(p => ({ label: p.plan, value: p.value, sub: `${p.count} cliente(s)` }))} />}
        </div>
      )}

      {/* Carteira atual — SNAPSHOT (não é do período). Seção própria, menor, abaixo. */}
      <section>
        <SectionLabel>Carteira atual · snapshot (não é do período)</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MetricCard title="MRR" value={dash ?? usd(exec?.mrr ?? 0)} size="sm" tone="positive" />
          <MetricCard title="ARR" value={dash ?? usd(exec?.arr ?? 0)} size="sm" />
          <MetricCard title="Clientes ativos" value={dash ?? (exec?.clientesAtivos ?? 0)} size="sm" tone="muted" subtitle="carteira total" />
          <MetricCard title="Clientes novos" value={dash ?? (exec?.clientesNovos ?? 0)} size="sm" subtitle="no período" />
        </div>
      </section>

      {/* Funil por etapa + gargalo — só quando há leads no funil */}
      {!loading && funnel.length > 0 && (
        <section>
          <SectionLabel>Funil por etapa</SectionLabel>
          <div className="bento-fx p-3 space-y-2.5">
            {funnel.map((f, i) => (
              <div key={f.stage}>
                <div className="flex items-center justify-between text-[12px] mb-1 gap-2">
                  <span className="text-bento-text truncate">
                    {f.stage}{i === 0 && <span className="ml-2 text-[10px] font-tech uppercase tracking-wide text-amber-400">gargalo</span>}
                  </span>
                  <span className="text-bento-muted shrink-0 tabular-nums">{f.count}{f.avgDays != null ? ` · ${f.avgDays}d` : ''}</span>
                </div>
                <div className="h-1.5 rounded-full bg-bento-panel overflow-hidden">
                  <div className={cn('h-full rounded-full', i === 0 ? 'bg-amber-400' : 'bg-lime')} style={{ width: `${Math.round((f.count / maxFunnel) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pontos de atenção (insights automáticos, sem IA) — só quando há */}
      {!loading && insights.length > 0 && (
        <section>
          <SectionLabel>Pontos de atenção</SectionLabel>
          <ul className="bento-fx p-3 space-y-2">
            {insights.map((ins, i) => {
              const { Icon, cls } = INSIGHT_STYLE[ins.kind]
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cls)} />
                  <span className="text-[13px] text-bento-text leading-snug">{ins.message}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
