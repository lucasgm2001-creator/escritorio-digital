import { IntegrationProviderCard } from './IntegrationProviderCard'
import type { IntegrationProvider } from '@/lib/integrations/types'

// Grade de conexões de integração (PREINTEGRATION-001). Um único componente para todas as telas.
export function IntegrationGrid({ providers }: { providers: IntegrationProvider[] }) {
  if (providers.length === 0) return <p className="text-sm text-bento-muted">Nenhuma integração disponível.</p>
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {providers.map(provider => <IntegrationProviderCard key={provider.key} provider={provider} />)}
    </div>
  )
}
