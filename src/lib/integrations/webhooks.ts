import type { IntegrationProviderKey, IntegrationHealthState } from './types'

// Gestão de WEBHOOKS (INT-001). Contrato PURO — nenhum endpoint real, nenhum runtime, nenhum secret gerado
// ou gravado. Generaliza a visão de gerenciamento (lista/endpoint/status/secret/última chamada/último erro/
// quantidade) para entrada E saída. Coexiste com o webhook Magnetic real (/api/leads/inbound) e com os stubs
// /api/inbound/[provider] — nunca os reescreve (INT-001).

export type WebhookDirection = 'inbound' | 'outbound'
export type WebhookEndpointStatus = 'active' | 'disabled' | 'not_configured'

export type WebhookEndpoint = {
  id: string
  provider: IntegrationProviderKey
  direction: WebhookDirection
  url: string                                  // caminho do endpoint (ex.: /api/inbound/:provider)
  method: 'POST'
  status: WebhookEndpointStatus
  secretPrefix: string | null                  // NUNCA o secret cru — só um prefixo público p/ identificação
  lastCallAt: string | null
  lastError: string | null
  deliveries: number                           // quantidade (contador)
  health: IntegrationHealthState
}

export const WEBHOOK_STATUS_LABELS: Record<WebhookEndpointStatus, string> = {
  active: 'Ativo', disabled: 'Desativado', not_configured: 'Não configurado',
}

// Colunas oficiais da lista de webhooks — a UI monta o cabeçalho a partir daqui.
export const WEBHOOK_COLUMNS = ['Endpoint', 'Status', 'Secret', 'Última chamada', 'Último erro', 'Qtd.'] as const
