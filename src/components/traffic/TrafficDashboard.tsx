import { Sparkles } from 'lucide-react'
import { AdminStat } from '@/components/admin/AdminStat'
import { Panel } from '@/components/bento/Panel'

// Dashboard executivo de Tráfego — PLACEHOLDERS (sem integração/API/dados). Reusa AdminStat + Panel.
const KPIS = [
  'Investimento', 'Receita', 'ROAS', 'CPA', 'CTR', 'CPM', 'CPC',
  'Conversões', 'Leads', 'Clientes ativos', 'Contas conectadas', 'Campanhas ativas',
]

const IA_ITEMS = [
  'Resumo executivo', 'Campanhas com problema', 'Oportunidades',
  'Próximas ações', 'Briefing automático', 'Resumo semanal', 'Resumo mensal',
]

export function TrafficDashboard() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">Tráfego</p>
        <h1 className="font-display font-bold text-2xl text-bento-text">Dashboard executivo</h1>
        <p className="text-sm text-bento-muted max-w-prose">
          Mídia paga consolidada (Meta, Google e mais). Fundação: indicadores como placeholders — sem integração,
          API ou dados nesta fase.
        </p>
      </header>

      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Indicadores</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {KPIS.map(kpi => (
            <AdminStat key={kpi} label={kpi} value="—" hint="em breve" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel label="Alertas">
          <p className="text-[13px] text-bento-muted leading-relaxed">
            Alertas de campanha (orçamento, queda de ROAS, sem entrega) aparecerão aqui quando as contas de anúncio
            forem conectadas.
          </p>
        </Panel>
        <Panel label="Inteligência (IA)">
          <div className="space-y-1.5">
            {IA_ITEMS.map(item => (
              <div key={item} className="flex items-center gap-2 text-[13px] text-bento-muted">
                <Sparkles className="w-3.5 h-3.5 text-bento-dim shrink-0" /> {item}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-bento-dim mt-2">Via AI Engine (AI-001).</p>
        </Panel>
      </div>
    </div>
  )
}
