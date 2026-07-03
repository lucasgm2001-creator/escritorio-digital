import { integrationsByCategory } from '@/lib/integrations/catalog'
import { IntegrationGrid } from '@/components/integrations/IntegrationGrid'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

// Cliente › Integrações — mesmo componente de conexão, providers relevantes ao cliente (pagamentos, mídia,
// analytics e mensagens). Sem integração real.
export default function ClientIntegracoesPage() {
  return (
    <div className="space-y-5">
      <WorkspaceHeader
        title="Integrações"
        subtitle="Conexões deste cliente. Nenhuma conta conectada — pronto para conectar quando autorizado."
        size="compact"
      />
      <IntegrationGrid providers={integrationsByCategory(['payments', 'ads', 'analytics', 'messaging'])} />
    </div>
  )
}
