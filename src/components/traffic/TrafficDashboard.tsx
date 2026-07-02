import Link from 'next/link'
import { AdminStat } from '@/components/admin/AdminStat'
import { Panel } from '@/components/bento/Panel'
import { AiInsightsPanel } from '@/components/ai/AiInsightsPanel'
import { TrafficPlatformGrid } from './TrafficPlatformGrid'

// Dashboard executivo de Tráfego — PLACEHOLDERS (sem integração/API/dados). Reusa AdminStat + Panel.
// Aceita clientName opcional: o MESMO componente servirá a aba "Tráfego" do cliente (só filtrado).
const STATUS = [
  { label: 'Contas conectadas', value: '0' },
  { label: 'Campanhas ativas', value: '0' },
  { label: 'Investimento (30d)', value: '—' },
  { label: 'Última sincronização', value: '—' },
]

const KPIS = [
  'Investimento', 'Receita', 'ROAS', 'CPA', 'CTR', 'CPM',
  'CPC', 'Conversões', 'Leads', 'CPL', 'Ticket médio', 'Clientes ativos',
]

const QUICK = [
  { label: 'Contas', href: '/trafego/contas' },
  { label: 'Campanhas', href: '/trafego/campanhas' },
  { label: 'Criativos', href: '/trafego/criativos' },
  { label: 'Relatórios', href: '/trafego/relatorios' },
  { label: 'IA', href: '/trafego/ia' },
]

const IA_ITEMS = [
  'Resumo executivo', 'Campanhas com problema', 'Oportunidades',
  'Próximas ações', 'Briefing automático', 'Resumo semanal', 'Resumo mensal',
]

export function TrafficDashboard({ clientName }: { clientName?: string }) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">
          Tráfego{clientName ? ` · ${clientName}` : ''}
        </p>
        <h1 className="font-display font-bold text-2xl text-bento-text">Dashboard executivo</h1>
        <p className="text-sm text-bento-muted">
          {clientName ? `Mídia paga de ${clientName}.` : 'Mídia paga consolidada (Meta, Google e mais).'} Indicadores em
          placeholder — sem integração ou API nesta fase.
        </p>
      </header>

      {/* Status operacional */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {STATUS.map(item => (
          <AdminStat key={item.label} label={item.label} value={item.value} hint="em breve" />
        ))}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {KPIS.map(kpi => (
            <AdminStat key={kpi} label={kpi} value="—" hint="em breve" />
          ))}
        </div>
      </div>

      {/* Plataformas (preparação visual) */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Plataformas</p>
        <TrafficPlatformGrid />
      </div>

      {/* Inteligência + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AiInsightsPanel items={IA_ITEMS} />
        <Panel label="Alertas">
          <p className="text-[13px] text-bento-muted leading-relaxed">
            Alertas de campanha (orçamento, queda de ROAS, sem entrega) aparecerão aqui quando as contas de anúncio
            forem conectadas.
          </p>
        </Panel>
      </div>
    </div>
  )
}
