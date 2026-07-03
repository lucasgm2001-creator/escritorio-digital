import Link from 'next/link'
import { MetricCard } from '@/components/ui/MetricCard'
import { Panel } from '@/components/bento/Panel'
import { AiInsightsPanel } from '@/components/ai/AiInsightsPanel'
import { TrafficHeader } from './TrafficHeader'
import { TrafficPlatformGrid } from './TrafficPlatformGrid'

// Dashboard executivo de Tráfego — PLACEHOLDERS elegantes (sem integração/API/dados). Reusa MetricCard +
// Panel + AiInsightsPanel + TrafficPlatformGrid. Aceita clientName: o MESMO dashboard serve a aba do cliente.
const STATUS = [
  { label: 'Contas conectadas', value: '0' },
  { label: 'Campanhas ativas', value: '0' },
  { label: 'Investimento (30d)', value: '—' },
  { label: 'Última sincronização', value: '—' },
]

const KPIS = [
  'Investimento', 'Impressões', 'Cliques', 'CTR', 'CPC',
  'CPM', 'CPA', 'ROAS', 'Conversões', 'Receita',
  'Leads', 'Clientes', 'CAC', 'LTV', 'ROI',
]

const QUICK = [
  { label: 'Contas', href: '/trafego/contas' },
  { label: 'Campanhas', href: '/trafego/campanhas' },
  { label: 'Criativos', href: '/trafego/criativos' },
  { label: 'Relatórios', href: '/trafego/relatorios' },
  { label: 'IA', href: '/trafego/ia' },
]

const IA_ITEMS = ['Resumo executivo', 'Campanhas com risco', 'Oportunidades', 'Próximas ações', 'Briefing semanal', 'Briefing mensal']

export function TrafficDashboard({ clientName }: { clientName?: string }) {
  return (
    <div className="space-y-6">
      <TrafficHeader
        breadcrumb={clientName ? ['Tráfego', clientName] : ['Tráfego']}
        title="Dashboard executivo"
        subtitle={`${clientName ? `Mídia paga de ${clientName}.` : 'Mídia paga consolidada (Meta, Google e mais).'} Indicadores em placeholder — conecte uma plataforma em Contas para começar.`}
      />

      {/* Status operacional + integrações */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {STATUS.map(item => <MetricCard key={item.label} title={item.label} value={item.value} size="sm" />)}
      </div>

      {/* Ações rápidas */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Ações rápidas</p>
        <div className="flex flex-wrap gap-2">
          {QUICK.map(action => (
            <Link key={action.href} href={action.href} className="bento-btn flex items-center px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold">
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Indicadores executivos */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Indicadores</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {KPIS.map(kpi => <MetricCard key={kpi} title={kpi} value="—" size="sm" />)}
        </div>
      </div>

      {/* Status das integrações */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Status das integrações</p>
        <TrafficPlatformGrid />
      </div>

      {/* Inteligência + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <AiInsightsPanel items={IA_ITEMS} />
        <Panel label="Alertas">
          <p className="text-[13px] text-bento-muted leading-relaxed">
            Alertas de campanha (orçamento, queda de ROAS, sem entrega) aparecem aqui quando as contas de anúncio
            forem conectadas.
          </p>
        </Panel>
      </div>
    </div>
  )
}
