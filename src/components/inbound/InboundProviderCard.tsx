import type { InboundProvider, InboundStatus, InboundCategory, InboundSecurityMode } from '@/lib/inbound/types'

// Card ÚNICO de provider de ENTRADA (INBOUND-001). Visual apenas — nenhum endpoint ativo, botão desativado.
// Espelha o padrão do IntegrationProviderCard (não duplica identidade visual).
const STATUS_LABEL: Record<InboundStatus, string> = {
  not_configured: 'Não configurado',
  requires_key: 'Requer chave',
  awaiting_provider: 'Aguardando provider',
  ready_to_configure: 'Pronto para configuração',
  endpoint_disabled: 'Endpoint não ativado',
  active: 'Ativo',
}
const AUTH_LABEL: Record<InboundSecurityMode, string> = {
  none: 'Sem auth', api_key: 'API key', secret_token: 'Secret token', hmac_signature: 'HMAC', bearer_token: 'Bearer',
}
const CATEGORY_LABEL: Record<InboundCategory, string> = {
  form: 'Formulário', ads: 'Anúncios', messaging: 'Mensagens', automation: 'Automação', payments: 'Pagamentos', generic: 'Genérico',
}

export function InboundProviderCard({ provider }: { provider: InboundProvider }) {
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
        <span className="text-[10px] font-tech uppercase tracking-wide text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0 text-right">{STATUS_LABEL[provider.status]}</span>
      </div>

      <p className="text-[12px] text-bento-muted leading-relaxed min-h-[2.5rem]">{provider.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {provider.capabilities.map(cap => (
          <span key={cap.key} className="text-[10px] text-bento-muted border border-bento-border rounded-full px-2 py-0.5">{cap.label}</span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-bento-dim">
        <span>Auth: {AUTH_LABEL[provider.auth]}</span>
        <span>{provider.allowsTest ? 'Teste ✓' : 'Teste —'} · {provider.allowsReplay ? 'Replay ✓' : 'Replay —'}</span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-bento-border/60">
        <span className="text-[10px] text-bento-dim">Sem entregas · não ativado</span>
        <button type="button" disabled className="text-[12px] font-semibold text-bento-dim border border-bento-border rounded-btn px-2.5 py-1 min-h-[36px] opacity-70 cursor-not-allowed">Configurar</button>
      </div>
    </div>
  )
}
