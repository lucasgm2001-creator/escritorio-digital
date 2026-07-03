import { INTEGRATION_PROVIDERS } from '@/lib/integrations/catalog'
import { IntegrationGrid } from '@/components/integrations/IntegrationGrid'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

// Administração › Integrações — catálogo de providers (PREINTEGRATION-001). Nada conecta.
export default function Page() {
  return (
    <div className="space-y-5">
      <WorkspaceHeader
        eyebrow="Administração"
        title="Integrações"
        subtitle="Provedores disponíveis para conectar. Nenhuma conta conectada — pronto para conectar quando autorizado."
        size="compact"
      />
      <IntegrationGrid providers={INTEGRATION_PROVIDERS} />
    </div>
  )
}
