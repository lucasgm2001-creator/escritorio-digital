import { AiInsightsPanel } from '@/components/ai/AiInsightsPanel'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'

export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="IA" subtitle="Copiloto de tráfego — resumos, anomalias, oportunidades e briefings." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <AiInsightsPanel label="Resumo executivo" items={['Visão geral do período', 'Comparação com o período anterior', 'Resumo para o gestor', 'Resumo para o cliente', 'Resumo para o comercial']} />
        <AiInsightsPanel label="Insights & anomalias" items={['Insights automáticos', 'Anomalias de gasto', 'Anomalias de desempenho', 'Quedas e picos incomuns']} />
        <AiInsightsPanel label="Campanhas" items={['Campanhas com risco', 'Campanhas com potencial', 'Sugestões de otimização', 'Próximas ações']} />
        <AiInsightsPanel label="Briefings & checklist" items={['Briefing semanal', 'Briefing mensal', 'Checklist de otimização', 'Plano da próxima semana']} />
      </div>
    </div>
  )
}
