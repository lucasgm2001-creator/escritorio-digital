import { Clock, Trophy, XCircle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/bento/Panel'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import type { CommercialDashboardVM } from '@/core/metrics/types'
import type { CommercialReport, ReportInsight } from '@/core/reporting/types'

function usd(value: number): string {
  return `US$ ${Number(value).toLocaleString('en-US')}`
}
function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

// Ícones/cor por tipo de insight (auto-regras do ReportingService — sem IA).
const INSIGHT_STYLE: Record<ReportInsight['kind'], { Icon: typeof Clock; cls: string }> = {
  gargalo: { Icon: Clock, cls: 'text-amber-400' },
  melhor_etapa: { Icon: Trophy, cls: 'text-emerald-400' },
  pior_etapa: { Icon: XCircle, cls: 'text-red-400' },
  no_show: { Icon: XCircle, cls: 'text-red-400' },
  queda_conversao: { Icon: TrendingUp, cls: 'text-red-400' },
}

// Dashboard Executivo (CRM-ULTIMATE-001). KPIs vêm do DashboardMetricsService; insights/funil/conversões
// vêm do ReportingService. DOIS serviços, ZERO cálculo na UI (ARCH-001) — só formatação e escala de barra.
export function DashboardExecutivo({ vm, report }: { vm: CommercialDashboardVM; report: CommercialReport }) {
  const hero: { title: string; value: string; tone: MetricTone }[] = [
    { title: 'Conversão', value: pct(vm.conversionRate), tone: 'positive' },
    { title: 'Pipeline', value: usd(vm.pipelineValue), tone: 'default' },
    { title: 'Receita realizada', value: usd(vm.revenueRealized), tone: 'emerald' },
    { title: 'Ticket médio', value: usd(vm.avgTicket), tone: 'default' },
  ]

  const groups: { title: string; cards: { label: string; value: string | number; tone?: MetricTone }[] }[] = [
    { title: 'Leads', cards: [
      { label: 'Ativos', value: vm.leadsActive },
      { label: 'Novos (7d)', value: vm.leadsNew, tone: 'positive' },
      { label: 'Parados', value: vm.leadsStuck, tone: vm.leadsStuck > 0 ? 'negative' : 'default' },
      { label: 'Tempo médio', value: `${vm.avgDaysAsLead}d` },
      { label: 'Tempo médio/fase', value: `${vm.avgDaysPerStage}d` },
    ] },
    { title: 'Funil & conversão', cards: [
      { label: 'Reuniões', value: vm.meetings },
      { label: 'No-shows', value: vm.noShows, tone: vm.noShows > 0 ? 'negative' : 'default' },
      { label: 'Propostas', value: vm.proposals },
      { label: 'Fechamentos', value: vm.closes, tone: 'positive' },
      { label: 'Conversão', value: pct(vm.conversionRate) },
    ] },
    { title: 'Receita', cards: [
      { label: 'Pipeline', value: usd(vm.pipelineValue) },
      { label: 'Prevista', value: usd(vm.revenueForecast) },
      { label: 'Realizada', value: usd(vm.revenueRealized), tone: 'emerald' },
      { label: 'Perdida', value: usd(vm.revenueLost), tone: vm.revenueLost > 0 ? 'negative' : 'default' },
    ] },
  ]

  const maxFunnel = Math.max(1, ...report.funnel.map(stage => stage.count))

  return (
    <div className="space-y-6">
      {/* Manchete executiva */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {hero.map(card => <MetricCard key={card.title} title={card.title} value={card.value} tone={card.tone} size="lg" />)}
      </div>

      {/* KPIs por grupo */}
      {groups.map(group => (
        <section key={group.title} className="space-y-2">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">{group.title}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {group.cards.map(card => <MetricCard key={card.label} title={card.label} value={card.value} tone={card.tone} size="sm" />)}
          </div>
        </section>
      ))}

      {/* Insights + Conversões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel label={`Insights · ${report.period.label}`}>
          {report.insights.length === 0 ? (
            <p className="text-[13px] text-bento-muted">Sem alertas relevantes no período.</p>
          ) : (
            <ul className="space-y-2">
              {report.insights.map((insight, i) => {
                const { Icon, cls } = INSIGHT_STYLE[insight.kind]
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cls)} />
                    <span className="text-[13px] text-bento-text leading-snug">{insight.message}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel label="Conversões">
          {report.conversions.length === 0 ? (
            <p className="text-[13px] text-bento-muted">Sem dados de conversão.</p>
          ) : (
            <div className="space-y-2.5">
              {report.conversions.map(step => (
                <div key={step.label}>
                  <div className="flex items-center justify-between text-[12px] mb-1 gap-2">
                    <span className="text-bento-muted truncate">{step.label}</span>
                    <span className="font-tech text-bento-text tabular-nums shrink-0">{pct(step.rate)}</span>
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

      {/* Funil por etapa — ranking + gargalo (etapa com mais leads acumulados) */}
      <Panel label="Funil por etapa">
        {report.funnel.length === 0 ? (
          <p className="text-[13px] text-bento-muted">Sem leads no funil.</p>
        ) : (
          <div className="space-y-2.5">
            {report.funnel.map((stage, i) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between text-[12px] mb-1 gap-2">
                  <span className="text-bento-text truncate">
                    {stage.stage}
                    {i === 0 && <span className="ml-2 text-[9px] font-tech uppercase tracking-wide text-amber-400">gargalo</span>}
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
    </div>
  )
}
