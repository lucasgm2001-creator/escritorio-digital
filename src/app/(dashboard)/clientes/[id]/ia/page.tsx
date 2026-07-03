import { AiInsightsPanel } from '@/components/ai/AiInsightsPanel'

// IA do Cliente — REUSA o AiInsightsPanel (mesma estrutura de IA de todo o sistema). Sem IA real.
export default function ClientIaPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">IA</h1>
        <p className="text-sm text-bento-muted">Copiloto do cliente — resumos, riscos, oportunidades e briefings.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <AiInsightsPanel label="Resumo do cliente" items={['Resumo executivo', 'Resumo financeiro', 'Resumo de tráfego', 'Sentimento']} />
        <AiInsightsPanel label="Riscos & oportunidades" items={['Riscos de churn', 'Pagamentos em atraso', 'Oportunidades de upsell', 'Próximas ações']} />
        <AiInsightsPanel label="Briefing" items={['Briefing semanal', 'Briefing mensal', 'Pontos de atenção', 'Plano da semana']} />
      </div>
    </div>
  )
}
