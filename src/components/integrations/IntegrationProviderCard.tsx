import type { IntegrationCategory, IntegrationProvider } from '@/lib/integrations/types'

// Card ÚNICO de conexão de integração (PREINTEGRATION-001). Reutilizado em Administração, Tráfego > Contas
// e Cliente > Integrações. Visual apenas — status desconectado, botão Conectar DESATIVADO, nada real.
const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  payments: 'Pagamentos', ads: 'Anúncios', analytics: 'Analytics', messaging: 'Mensagens', automation: 'Automação',
}
const envLabel = (env: string): string => (env === 'production' ? 'Produção' : 'Sandbox')

export function IntegrationProviderCard({ provider }: { provider: IntegrationProvider }) {
  return (
    <div className="bento-fx p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-bento bg-bento-panel border border-bento-border flex items-center justify-center shrink-0">
          <span className="font-tech text-[12px] font-bold text-bento-muted">{provider.monogram}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-bento-text truncate">{provider.name}</p>
          <p className="text-[10px] text-bento-dim">{CATEGORY_LABEL[provider.category]}</p>
        </div>
        <span className="text-[9px] font-tech uppercase tracking-wide text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">desconectado</span>
      </div>

      <p className="text-[12px] text-bento-muted leading-relaxed min-h-[2.5rem]">{provider.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {provider.capabilities.map(cap => (
          <span key={cap.key} className="text-[10px] text-bento-muted border border-bento-border rounded-full px-2 py-0.5">{cap.label}</span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-bento-dim">
        <span>{provider.environments.map(envLabel).join(' · ')}</span>
        <span>{provider.scopes.length} permissã{provider.scopes.length === 1 ? 'o' : 'es'}</span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-bento-border/60">
        <span className="text-[10px] text-bento-dim">Nunca sincronizado · health —</span>
        <button type="button" disabled className="text-[12px] font-semibold text-bento-dim border border-bento-border rounded-btn px-2.5 py-1 min-h-[36px] opacity-70 cursor-not-allowed">Conectar</button>
      </div>
    </div>
  )
}
