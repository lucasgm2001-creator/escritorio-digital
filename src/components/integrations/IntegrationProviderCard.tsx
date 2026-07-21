import { Download, Upload, Radio, Webhook, ArrowUpRight } from 'lucide-react'
import type { IntegrationAuthType, IntegrationProvider } from '@/lib/integrations/types'
import { CATEGORY_LABELS } from '@/lib/integrations/catalog'

// Card ÚNICO de conexão de integração (INT-001). Reutilizado em Administração › Integrações, Tráfego › Contas
// e Cliente › Integrações. Visual apenas — nada conecta. Providers que já operam por superfície atual
// (managedVia: Magnetic, Google) mostram o vínculo real em vez de fingir conexão; o resto fica desconectado.
const AUTH_LABEL: Record<IntegrationAuthType, string> = {
  oauth: 'OAuth', api_key: 'API Key', webhook: 'Webhook', manual: 'Manual',
}
const envLabel = (env: string): string => (env === 'production' ? 'Produção' : 'Sandbox')
const btnDisabled = 'text-[12px] font-semibold text-bento-dim border border-bento-border rounded-btn px-2.5 py-1 min-h-[36px] opacity-70 cursor-not-allowed'

export function IntegrationProviderCard({ provider }: { provider: IntegrationProvider }) {
  const live = provider.managedVia != null
  const flags = [
    provider.supportsImport ? { icon: Download, label: 'Leitura' } : null,
    provider.supportsExport ? { icon: Upload, label: 'Escrita' } : null,
    provider.supportsRealtime ? { icon: Radio, label: 'Tempo real' } : null,
    provider.supportsWebhook ? { icon: Webhook, label: 'Webhook' } : null,
  ].filter(Boolean) as { icon: typeof Download; label: string }[]

  return (
    <div className="bento-fx p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-bento bg-bento-panel border border-bento-border flex items-center justify-center shrink-0">
          <span className="font-tech text-[12px] font-bold text-bento-muted">{provider.monogram}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-bento-text truncate">{provider.name}</p>
          <p className="text-[10px] text-bento-dim">{CATEGORY_LABELS[provider.category]}</p>
        </div>
        {live ? (
          <span className="text-[10px] font-tech uppercase tracking-wide text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-1.5 py-0.5 shrink-0">atual</span>
        ) : (
          <span className="text-[10px] font-tech uppercase tracking-wide text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">desconectado</span>
        )}
      </div>

      <p className="text-[12px] text-bento-muted leading-relaxed min-h-[2.5rem]">{provider.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {provider.capabilities.map(cap => (
          <span key={cap.key} className="text-[10px] text-bento-muted border border-bento-border rounded-full px-2 py-0.5">{cap.label}</span>
        ))}
      </div>

      {/* Autenticação · versão · flags de capacidade (leitura/escrita/tempo real/webhook). */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-bento-dim">
        <span className="font-tech uppercase tracking-wide">{AUTH_LABEL[provider.authType]} · v{provider.version}</span>
        <div className="flex items-center gap-2">
          {flags.map(f => <f.icon key={f.label} className="w-3.5 h-3.5" aria-label={f.label} />)}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-bento-border/60">
        {live && provider.managedVia?.href ? (
          <a href={provider.managedVia.href} className="text-[11px] text-bento-muted hover:text-bento-text inline-flex items-center gap-1 min-h-[36px]">
            Ativo em {provider.managedVia.label} <ArrowUpRight className="w-3 h-3" />
          </a>
        ) : live ? (
          <span className="text-[11px] text-bento-muted">Ativo · {provider.managedVia?.label}</span>
        ) : (
          <span className="text-[10px] text-bento-dim">{provider.environments.map(envLabel).join(' · ')} · saúde —</span>
        )}
        <button type="button" disabled className={btnDisabled}>{live ? 'Gerenciar' : 'Conectar'}</button>
      </div>
    </div>
  )
}
