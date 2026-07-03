import { AiInsightsPanel } from '@/components/ai/AiInsightsPanel'

// IA do Cliente — REUSA o AiInsightsPanel (mesma estrutura de IA de todo o sistema). Sem IA real.
export default function ClientIaPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">IA</h1>
        <p className="text-sm text-bento-muted">Copiloto do cliente — resumos, riscos, pagamentos, tráfego e briefings.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <AiInsightsPanel label="Resumo executivo" items={['Resumo do cliente', 'Resumo financeiro', 'Resumo de tráfego', 'Sentimento']} />
        <AiInsightsPanel label="Riscos & oportunidades" items={['Riscos de churn', 'Oportunidades de upsell', 'Próximas ações', 'Pontos de atenção']} />
        <AiInsightsPanel label="Pagamentos" items={['Pagamentos em atraso', 'Falhas de pagamento', 'Reembolsos e chargebacks', 'Previsão de recebimento']} />
        <AiInsightsPanel label="Briefing" items={['Briefing semanal', 'Briefing mensal', 'Resumo de tráfego', 'Plano da semana']} />
      </div>
    </div>
  )
}
