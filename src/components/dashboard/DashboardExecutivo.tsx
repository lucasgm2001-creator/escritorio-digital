import type { CommercialDashboardVM } from '@/core/metrics/types'

function usd(value: number): string {
  return `US$ ${Number(value).toLocaleString('en-US')}`
}
function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

// Dashboard Executivo (PLATFORM-003). 100% derivado do DashboardMetricsService — nenhuma conta aqui.
export function DashboardExecutivo({ vm }: { vm: CommercialDashboardVM }) {
  const groups: { title: string; cards: { label: string; value: string | number }[] }[] = [
    {
      title: 'Leads',
      cards: [
        { label: 'Ativos', value: vm.leadsActive },
        { label: 'Novos (7d)', value: vm.leadsNew },
        { label: 'Parados', value: vm.leadsStuck },
        { label: 'Tempo médio', value: `${vm.avgDaysAsLead}d` },
        { label: 'Tempo médio/fase', value: `${vm.avgDaysPerStage}d` },
      ],
    },
    {
      title: 'Funil',
      cards: [
        { label: 'Reuniões', value: vm.meetings },
        { label: 'No-shows', value: vm.noShows },
        { label: 'Propostas', value: vm.proposals },
        { label: 'Fechamentos', value: vm.closes },
        { label: 'Conversão', value: pct(vm.conversionRate) },
        { label: 'Ticket médio', value: usd(vm.avgTicket) },
      ],
    },
    {
      title: 'Receita',
      cards: [
        { label: 'Pipeline', value: usd(vm.pipelineValue) },
        { label: 'Prevista', value: usd(vm.revenueForecast) },
        { label: 'Realizada', value: usd(vm.revenueRealized) },
        { label: 'Perdida', value: usd(vm.revenueLost) },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <section key={group.title} className="space-y-2">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">{group.title}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {group.cards.map(card => (
              <div key={card.label} className="bento-fx p-3">
                <p className="font-display font-bold text-lg text-bento-text leading-none truncate">{card.value}</p>
                <p className="text-[11px] text-bento-muted mt-1.5 truncate">{card.label}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
