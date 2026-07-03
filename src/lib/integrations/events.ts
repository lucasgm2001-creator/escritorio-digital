import type { IntegrationProviderKey, IntegrationScope } from './types'

// Contratos de EVENTOS de integração (PREINTEGRATION-001). Tipos PUROS — nenhum publisher, nenhuma
// emissão real. Prontos para o Event Bus / Automation Engine futuros.
export type IntegrationEventType =
  | 'integration.connected' | 'integration.disconnected' | 'integration.failed'
  | 'integration.sync.started' | 'integration.sync.completed' | 'integration.sync.failed'
  | 'integration.webhook.received' | 'integration.webhook.processed' | 'integration.webhook.failed'

export type IntegrationEvent<TPayload = unknown> = {
  type: IntegrationEventType
  provider: IntegrationProviderKey
  scope: IntegrationScope
  at: string           // ISO
  payload: TPayload
}

export const INTEGRATION_EVENT_TYPES: IntegrationEventType[] = [
  'integration.connected', 'integration.disconnected', 'integration.failed',
  'integration.sync.started', 'integration.sync.completed', 'integration.sync.failed',
  'integration.webhook.received', 'integration.webhook.processed', 'integration.webhook.failed',
]
