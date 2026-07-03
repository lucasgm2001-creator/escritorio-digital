import { INTEGRATION_PROVIDERS } from '@/lib/integrations/catalog'
import { IntegrationGrid } from '@/components/integrations/IntegrationGrid'

// Administração › Integrações — catálogo de providers (PREINTEGRATION-001). Nada conecta.
export default function Page() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">Administração</p>
        <h1 className="font-display font-bold text-xl text-bento-text">Integrações</h1>
        <p className="text-sm text-bento-muted">Provedores disponíveis para conectar. Nenhuma conta conectada — pronto para conectar quando autorizado.</p>
      </header>
      <IntegrationGrid providers={INTEGRATION_PROVIDERS} />
    </div>
  )
}
