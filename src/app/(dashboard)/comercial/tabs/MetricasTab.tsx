'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, FileDown } from 'lucide-react'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import { ALL_COLUMNS } from '../types'
import { usdCompact as fmt } from '@/lib/format'
import { rangeFor, type Mode, type Range } from '@/lib/period'
import { PeriodNavigator } from '@/components/ui/PeriodNavigator'
import type { CommercialMetricsTabVM } from '@/core/metrics/types'
import { getCommercialMetricsTabAction } from '../metrics-actions'
import { getExecutiveReportAction } from '../../mesa/report-actions'

// Aba Métricas — SÓ apresenta. Todos os KPIs/rankings/gráficos vêm do CommercialMetricsService (ARCH-001);
// nenhum acesso a Supabase e nenhum cálculo de regra aqui (só formatação e largura de barra).
// Unidades navegáveis + "Tudo". Rótulos curtos: quem diz QUAL período é o navegador ao lado.
const METRICAS_MODES: [Mode, string][] = [['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre'], ['ano', 'Ano'], ['tudo', 'Tudo']]
const toYmd = (d: Date): string => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const STYLE_BY_KEY = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c])) as Record<string, (typeof ALL_COLUMNS)[number]>
const card = 'bento-fx p-5'
// Taxa null = sem base no período. Mostra "—", não 0%: 0% afirmaria que houve oportunidade e falhou.
const rate = (r: number | null): string => (r == null ? '—' : `${Math.round(r * 100)}%`)

export function MetricasTab() {
  const [range, setRange] = useState<Range>(() => rangeFor('mes'))
  const [vm, setVm] = useState<CommercialMetricsTabVM | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  // Gerar relatório do período que está na tela. Reusa a MESMA server action e o MESMO builder de PDF do
  // Relatório da Minha Mesa — se cada tela montasse o próprio, os dois PDFs poderiam divergir. O import do
  // builder é dinâmico: é uma dependência pesada que só carrega quando o botão é clicado.
  const gerarRelatorio = async () => {
    if (pdfBusy) return
    setPdfBusy(true); setPdfError(null)
    try {
      const r = await getExecutiveReportAction({ fromYMD: toYmd(range.start), toYMD: toYmd(range.end), label: range.label })
      if (!r.ok) { setPdfError(r.error); return }
      const { buildExecutivePdf } = await import('@/lib/commercial/executive-pdf')
      await buildExecutivePdf({ exec: r.exec, execPrev: r.execPrev, report: r.report, workspace: r.workspace, user: r.user })
    } catch {
      setPdfError('Não foi possível gerar o relatório.')
    } finally {
      setPdfBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    setVm(null)
    // 'tudo' não tem janela — o serviço monta o range dele. Os demais mandam de–até explícito, que é o que
    // permite ver mês passado, trimestre anterior ou janela personalizada.
    const window = range.mode === 'tudo'
      ? undefined
      : { fromYMD: toYmd(range.start), toYMD: toYmd(range.end), label: range.label }
    getCommercialMetricsTabAction(range.mode as Mode, window).then(data => { if (active) setVm(data) })
    return () => { active = false }
  }, [range])

  // Três blocos, nessa ordem: o que foi FEITO → quão bem converteu → quanto deu em dinheiro.
  const ACOES: { label: string; value: string; sub: string; tone: MetricTone }[] = vm ? [
    { label: 'Leads recebidos',      value: String(vm.acoes.recebidos),          sub: 'entraram no período',    tone: 'default' },
    { label: 'Leads trabalhados',    value: String(vm.acoes.trabalhados),        sub: 'tiveram interação',      tone: 'default' },
    { label: 'Reuniões marcadas',    value: String(vm.acoes.reunioesMarcadas),   sub: 'agendadas no período',   tone: 'default' },
    { label: 'Reuniões realizadas',  value: String(vm.acoes.reunioesRealizadas), sub: 'aconteceram de fato',    tone: 'default' },
    { label: 'Propostas enviadas',   value: String(vm.acoes.propostas),          sub: 'foram para análise',     tone: 'blue' },
    { label: 'Vendas fechadas',      value: String(vm.acoes.vendas),             sub: 'contratos no período',   tone: 'positive' },
  ] : []

  const TAXAS: { label: string; value: string; sub: string; tone: MetricTone }[] = vm ? [
    { label: 'Taxa de interação',    value: rate(vm.taxas.interacao),        sub: `${vm.acoes.trabalhados} de ${vm.acoes.recebidos} recebidos`,               tone: 'default' },
    { label: 'Marcada → realizada',  value: rate(vm.taxas.marcadaRealizada), sub: `${vm.acoes.reunioesRealizadas} de ${vm.acoes.reunioesMarcadas} marcadas`,  tone: 'default' },
    { label: 'Reunião → venda',      value: rate(vm.taxas.reuniaoVenda),     sub: `${vm.acoes.vendas} de ${vm.acoes.reunioesRealizadas} realizadas`,          tone: 'emerald' },
    { label: 'Taxa de conversão',    value: rate(vm.taxas.conversao),        sub: `${vm.acoes.vendas} de ${vm.acoes.recebidos} recebidos`,                    tone: 'emerald' },
  ] : []

  const RESULTADO: { label: string; value: string; sub: string; tone: MetricTone }[] = vm ? [
    { label: 'Receita fechada', value: fmt(vm.kpis.closedValue), sub: `${vm.acoes.vendas} contrato(s)`,     tone: 'positive' },
    { label: 'Ticket médio',    value: fmt(vm.kpis.avgTicket),   sub: 'por venda no período',               tone: 'blue' },
    { label: 'Pipeline',        value: fmt(vm.kpis.pipeline),    sub: 'em aberto dos leads do período',     tone: 'default' },
  ] : []

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full bg-background">
      {/* Período NAVEGÁVEL (setas ← →) + unidade + janela personalizada. Padrão = mês corrente. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PeriodNavigator range={range} onChange={setRange} modes={METRICAS_MODES} />
        <button type="button" onClick={gerarRelatorio} disabled={pdfBusy}
          className="inline-flex items-center gap-2 rounded-btn border border-bento-border px-3 min-h-[40px] text-sm font-medium text-bento-dim transition-colors hover:border-lime hover:text-bento-text disabled:opacity-50">
          <FileDown className="h-4 w-4" />{pdfBusy ? 'Gerando…' : 'Gerar relatório'}
        </button>
      </div>

      {pdfError && (
        <div className="rounded-btn border border-amber-800/40 bg-amber-900/20 px-4 py-3 text-xs text-amber-400">{pdfError}</div>
      )}

      {!vm ? (
        <p className="text-sm text-bento-muted py-10 text-center">Carregando métricas…</p>
      ) : (
        <>
          {/* 1 · O QUE FOI FEITO — contagem de ações no período, antes de qualquer taxa. */}
          <section className="space-y-2.5">
            <h3 className="font-tech text-label uppercase tracking-label text-bento-muted">O que foi feito · {vm.periodLabel}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {ACOES.map(m => <MetricCard key={m.label} size="md" tone={m.tone} title={m.label} value={m.value} subtitle={m.sub} />)}
            </div>
          </section>

          {/* 2 · EFICIÊNCIA — cada degrau do funil, com a base explícita no subtítulo. */}
          <section className="space-y-2.5">
            <h3 className="font-tech text-label uppercase tracking-label text-bento-muted">Eficiência</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {TAXAS.map(m => <MetricCard key={m.label} size="md" tone={m.tone} title={m.label} value={m.value} subtitle={m.sub} />)}
            </div>
          </section>

          {/* 3 · RESULTADO — o dinheiro do período. */}
          <section className="space-y-2.5">
            <h3 className="font-tech text-label uppercase tracking-label text-bento-muted">Resultado</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {RESULTADO.map(m => <MetricCard key={m.label} size="md" tone={m.tone} title={m.label} value={m.value} subtitle={m.sub} />)}
            </div>
          </section>

          <div className="flex items-center gap-3 pt-2">
            <TrendingUp className="h-4 w-4 shrink-0 text-bento-muted" />
            <h3 className="font-tech text-label uppercase tracking-label text-bento-muted">Detalhamento</h3>
            <span className="h-px flex-1 bg-bento-border" />
          </div>
          <p className="font-tech text-caption text-bento-muted">Estado atual do funil (não filtra por período):</p>

          {/* Meio: Funil por Etapa | Valor por Estágio | Receita por Vendedor */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Funil por Etapa</h3>
              <div className="space-y-2.5">
                {vm.funnel.map(stage => {
                  const st = STYLE_BY_KEY[stage.key]
                  return (
                    <div key={stage.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-none ${st.dotColor}`} />
                          <span className="text-xs text-muted-foreground truncate">{st.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums">{stage.count}</span>
                      </div>
                      <div className="h-1.5 bg-bento-bg rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${st.dotColor}`} style={{ width: `${(stage.count / vm.maxCount) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Valor por Estágio</h3>
              <div className="space-y-3">
                {vm.stageValues.map(stage => {
                  const st = STYLE_BY_KEY[stage.key]
                  return (
                    <div key={stage.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-none ${st.dotColor}`} />
                          <span className={`text-xs font-medium truncate ${st.textColor}`}>{st.label}</span>
                          <span className="text-label text-muted-foreground flex-none">({stage.count})</span>
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground tabular-nums">{fmt(stage.value)}</span>
                      </div>
                      <div className="h-2 bg-bento-bg rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${st.dotColor}`} style={{ width: `${(stage.value / vm.maxStageValue) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
                {vm.stageValues.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>}
              </div>
            </div>

            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Receita por Vendedor <span className="font-tech text-label text-muted-foreground">· no período</span></h3>
              <div className="space-y-3">
                {vm.bySeller.map(seller => (
                  <div key={seller.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-lime/15 flex items-center justify-center flex-none">
                          <span className="text-label font-bold text-lime-fg">{seller.name.split(' ')[0]?.[0] ?? '?'}</span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground truncate">{seller.name}</span>
                        <span className="text-label text-muted-foreground flex-none">({seller.count})</span>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">{fmt(seller.value)}</span>
                    </div>
                    <div className="h-2 bg-bento-bg rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-lime" style={{ width: `${(seller.value / vm.maxSellerValue) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {vm.bySeller.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>}
              </div>
            </div>
          </div>

          {/* Embaixo: Resumo | Temperatura */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Resumo</h3>
              <div className="flex justify-around">
                <div className="text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold text-foreground tabular-nums">{vm.snapshot.total}</p></div>
                <div className="text-center"><p className="text-xs text-muted-foreground">Ativos</p><p className="text-lg font-bold text-foreground tabular-nums">{vm.snapshot.ativos}</p></div>
                <div className="text-center"><p className="text-xs text-muted-foreground">Fechados</p><p className="text-lg font-bold text-lime-fg tabular-nums">{vm.snapshot.fechados}</p></div>
              </div>
            </div>

            <div className={card}>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Temperatura dos Leads</h3>
              <div className="space-y-3">
                {[
                  { label: 'Quente', count: vm.temperature.hot,  barClass: 'bg-orange-500', textClass: 'text-orange-400' },
                  { label: 'Morno',  count: vm.temperature.warm, barClass: 'bg-yellow-500', textClass: 'text-yellow-400' },
                  { label: 'Frio',   count: vm.temperature.cold, barClass: 'bg-slate-500',  textClass: 'text-slate-400' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-medium ${item.textClass}`}>{item.label}</span>
                      <span className="text-xs font-semibold text-foreground tabular-nums">{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-bento-bg rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.barClass}`} style={{ width: vm.snapshot.total > 0 ? `${(item.count / vm.snapshot.total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
