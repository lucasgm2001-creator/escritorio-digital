import { integrationsByCategory } from '@/lib/integrations/catalog'
import { IntegrationGrid } from '@/components/integrations/IntegrationGrid'

// Cliente › Integrações — mesmo componente de conexão, providers relevantes ao cliente (pagamentos, mídia,
// analytics e mensagens). Sem integração real.
export default function ClientIntegracoesPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">Integrações</h1>
        <p className="text-sm text-bento-muted">Conexões deste cliente. Nenhuma conta conectada — pronto para conectar quando autorizado.</p>
      </header>
      <IntegrationGrid providers={integrationsByCategory(['payments', 'ads', 'analytics', 'messaging'])} />
    </div>
  )
}
