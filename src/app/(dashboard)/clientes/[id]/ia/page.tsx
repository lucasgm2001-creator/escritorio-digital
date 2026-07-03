import { AiInsightsPanel } from '@/components/ai/AiInsightsPanel'

// IA do Cliente — REUSA o AiInsightsPanel (mesmo componente de IA de todo o sistema). Sem IA real.
const CLIENT_AI = ['Resumo do cliente', 'Últimos insights', 'Riscos', 'Próximas ações', 'Briefing', 'Sentimento']

export default function ClientIaPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">IA</h1>
        <p className="text-sm text-bento-muted">Copiloto do cliente — mesma estrutura de IA de todo o Escritório Digital.</p>
      </header>
      <AiInsightsPanel items={CLIENT_AI} />
    </div>
  )
}
