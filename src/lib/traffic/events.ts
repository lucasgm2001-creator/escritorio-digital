import type { TrafficScope } from './types'

// Contratos de EVENTOS do domínio Tráfego (TRAFFIC-002). Tipos PUROS — nenhum publisher, nenhuma
// implementação. Prontos para o Event Bus futuro (Automation/Reporting/AI consomem sem refatorar).
export type TrafficEventType =
  | 'campaign.created' | 'campaign.updated' | 'campaign.paused' | 'campaign.enabled' | 'campaign.deleted'
  | 'creative.created' | 'creative.updated'
  | 'ad.created'
  | 'conversion.received'
  | 'integration.connected' | 'integration.failed'
  | 'sync.completed' | 'sync.failed'

// Escopo multi-tenant + opcional por cliente (o mesmo evento serve global e dentro do cliente).
export type TrafficEvent<TPayload = unknown> = {
  type: TrafficEventType
  scope: TrafficScope
  at: string           // ISO
  payload: TPayload
}

// Lista canônica (para docs/registradores futuros). Sem efeito colateral.
export const TRAFFIC_EVENT_TYPES: TrafficEventType[] = [
  'campaign.created', 'campaign.updated', 'campaign.paused', 'campaign.enabled', 'campaign.deleted',
  'creative.created', 'creative.updated',
  'ad.created',
  'conversion.received',
  'integration.connected', 'integration.failed',
  'sync.completed', 'sync.failed',
]
