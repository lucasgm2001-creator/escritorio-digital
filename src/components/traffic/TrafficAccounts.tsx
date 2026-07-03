import { TrafficHeader } from './TrafficHeader'
import { IntegrationGrid } from '@/components/integrations/IntegrationGrid'
import { integrationsByCategory } from '@/lib/integrations/catalog'

// Workspace de CONTAS do Tráfego — REUSA o componente único de conexão (IntegrationGrid) com os providers
// de anúncios e analytics. Sem integração real. Reutilizável (global e cliente via scopeLabel).
export function TrafficAccounts({ scopeLabel }: { scopeLabel?: string }) {
  return (
    <div className="space-y-6">
      <TrafficHeader
        eyebrow={scopeLabel ? `Tráfego · ${scopeLabel}` : 'Tráfego'}
        title="Contas"
        subtitle="Sem contas conectadas. Conecte uma plataforma para começar a trazer campanhas, conversões e analytics."
      />
      <IntegrationGrid providers={integrationsByCategory(['ads', 'analytics'])} />
    </div>
  )
}
