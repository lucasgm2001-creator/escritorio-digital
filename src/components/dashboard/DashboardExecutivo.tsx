import { Clock, Trophy, XCircle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/bento/Panel'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import type { ExecutiveMetricsVM } from '@/core/metrics/types'
import type { CommercialReport, ReportInsight } from '@/core/reporting/types'

const usd = (v: number): string => `US$ ${Math.round(Number(v)).toLocaleString('en-US')}`
const pctWhole = (v: number): string => `${Math.round(v)}%`      // conversão do ExecutiveMetricsService já vem 0..100
const pctRate = (r: number): string => `${Math.round(r * 100)}%` // report.conversions.rate vem 0..1

const INSIGHT_STYLE: Record<ReportInsight['kind'], { Icon: typeof Clock; cls: string }> = {
  gargalo: { Icon: Clock, cls: 'text-amber-400' },
  melhor_etapa: { Icon: Trophy, cls: 'text-emerald-400' },
  pior_etapa: { Icon: XCircle, cls: 'text-red-400' },
  no_show: { Icon: XCircle, cls: 'text-red-400' },
  queda_conversao: { Icon: TrendingUp, cls: 'text-red-400' },
}

// Lista de barras (receita por vendedor / plano) — só apresentação; os números vêm prontos do serviço.
function BarList({ rows, max }: { rows: { label: string; value: number; sub: string }[]; max: number }) {
  if (rows.length === 0) return <p className="text-note text-bento-muted">Sem receita recebida no período.</p>
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-caption mb-1 gap-2">
            <span className="text-bento-text truncate">{r.label} <span className="text-bento-dim">· {r.sub}</span></span>
            <span className="font-tech text-bento-text tabular-nums shrink-0">{usd(r.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-bento-panel overflow-hidden">
            <div className="h-full bg-lime rounded-full" style={{ width: `${Math.min(100, Math.round((r.value / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Dashboard Executivo (EXECUTIVE-METRICS-002). TODOS os KPIs executivos vêm do ExecutiveMetricsService (vm);
// funil por etapa + insights + conversões-por-etapa vêm do ReportingService (report). ZERO cálculo na UI.
// Renomes canônicos: "Receita realizada" (=soma de deals) → "Valor Fechado"; a receita de verdade agora é
// "Receita Recebida" (client_payments). Conversão/Ticket passam a ser period-aware (registry).
export function DashboardExecutivo({ vm, weekReceita, report }: { vm: ExecutiveMetricsVM; weekReceita: number; report: CommercialReport }) {
  // Z1 · Como estou hoje — manchete executiva. Receita pesa mais (Recebida/Prevista/MRR); Conversão fecha o hero.
  const hero: { title: string; value: string; tone: MetricTone }[] = [
    { title: 'Receita Recebida', value: usd(vm.receitaRecebida), tone: 'emerald' },
    { title: 'Receita Prevista', value: usd(vm.receitaPrevista), tone: 'default' },
    { title: 'MRR', value: usd(vm.mrr), tone: 'positive' },
    { title: 'Conversão', value: pctWhole(vm.conversao), tone: 'default' },
  ]
  // Z3 · Resultados — secundários (dinheiro primeiro, contagens por último). NÃO repete o hero (dedup CRM-02A).
  const resultados: { label: string; value: string | number; tone?: MetricTone }[] = [
    { label: 'Semanal', value: usd(weekReceita) },
    { label: 'Valor Fechado', value: usd(vm.valorFechado) },
    { label: 'ARR', value: usd(vm.arr) },
    { label: 'Ticket Médio', value: usd(vm.ticketMedio) },
    { label: 'Clientes Ativos', value: vm.clientesAtivos },
    { label: 'Clientes Novos', value: vm.clientesNovos, tone: vm.clientesNovos > 0 ? 'positive' : 'default' },
  ]

  const maxFunnel = Math.max(1, ...report.funnel.map(stage => stage.count))
  const maxSeller = Math.max(1, ...vm.receitaPorVendedor.map(s => s.value))
  const maxPlan = Math.max(1, ...vm.receitaPorPlano.map(p => p.value))

  return (
    <div className="space-y-6">
      {/* 1 · COMO ESTOU HOJE — manchete executiva (dinheiro em destaque). */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {hero.map(card => <MetricCard key={card.title} title={card.title} value={card.value} tone={card.tone} size="lg" />)}
      </div>

      {/* 2 · ONDE ESTÁ O PROBLEMA — Insights logo após o hero, largura total. Calmo (Panel), não compete com a Receita. */}
      <Panel label={`Insights · ${report.period.label}`}>
        {report.insights.length === 0 ? (
          <p className="text-note text-bento-muted">Sem alertas relevantes no período.</p>
        ) : (
          <ul className="space-y-2">
            {report.insights.map((insight, i) => {
              const { Icon, cls } = INSIGHT_STYLE[insight.kind]
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cls)} />
                  <span className="text-note text-bento-text leading-snug">{insight.message}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {/* 3 · COMO ESTÃO MEUS RESULTADOS — secundários (dinheiro primeiro, contagens por último). Sem repetir o hero. */}
      <section className="space-y-2">
        <p className="font-tech text-label uppercase tracking-label text-bento-muted">Resultados · {vm.periodLabel}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {resultados.map(card => <MetricCard key={card.label} title={card.label} value={card.value} tone={card.tone} size="sm" />)}
        </div>
      </section>

      {/* 4 · PIPELINE — funil por etapa (com gargalo) + conversões por etapa. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel label="Funil por etapa">
          {report.funnel.length === 0 ? (
            <p className="text-note text-bento-muted">Sem leads no funil.</p>
          ) : (
            <div className="space-y-2.5">
              {report.funnel.map((stage, i) => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between text-caption mb-1 gap-2">
                    <span className="text-bento-text truncate">
                      {stage.stage}
                      {i === 0 && <span className="ml-2 text-label font-tech uppercase tracking-label text-amber-400">gargalo</span>}
                    </span>
                    <span className="text-bento-muted shrink-0 tabular-nums">
                      {stage.count}{stage.avgDays != null ? ` · ${stage.avgDays}d` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bento-panel overflow-hidden">
                    <div className={cn('h-full rounded-full', i === 0 ? 'bg-amber-400' : 'bg-lime')} style={{ width: `${Math.round((stage.count / maxFunnel) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel label="Conversões por etapa">
          {report.conversions.length === 0 ? (
            <p className="text-note text-bento-muted">Sem dados de conversão.</p>
          ) : (
            <div className="space-y-2.5">
              {report.conversions.map(step => (
                <div key={step.label}>
                  <div className="flex items-center justify-between text-caption mb-1 gap-2">
                    <span className="text-bento-muted truncate">{step.label}</span>
                    <span className="font-tech text-bento-text tabular-nums shrink-0">{pctRate(step.rate)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bento-panel overflow-hidden">
                    <div className="h-full bg-lime rounded-full" style={{ width: `${Math.min(100, Math.round(step.rate * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* 5 · DETALHES PARA CONSULTAR — receita por vendedor / plano (recebida no período). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel label={`Receita por vendedor · ${vm.periodLabel}`}>
          <BarList rows={vm.receitaPorVendedor.map(s => ({ label: s.name, value: s.value, sub: `${s.count} cliente(s)` }))} max={maxSeller} />
        </Panel>
        <Panel label={`Receita por plano · ${vm.periodLabel}`}>
          <BarList rows={vm.receitaPorPlano.map(p => ({ label: p.plan, value: p.value, sub: `${p.count} cliente(s)` }))} max={maxPlan} />
        </Panel>
      </div>
    </div>
  )
}
