import type { InboundProviderKey, InboundLogStatus } from './types'

// Eventos futuros da entrada (INBOUND-001, Part 9). Só CONTRATOS — não há publisher real. Quando o motor de
// eventos (EVENTS-001) existir, o fluxo de entrada emitirá estes tipos, que a Timeline e as Automações
// poderão consumir. Nada é emitido hoje.
export const INBOUND_EVENTS = [
  'inbound.received',
  'inbound.validated',
  'inbound.rejected',
  'inbound.mapped',
  'inbound.lead.created',
  'inbound.duplicate.detected',
  'inbound.replay.requested',
  'inbound.failed',
] as const

export type InboundEventType = typeof INBOUND_EVENTS[number]

export type InboundEvent = {
  type: InboundEventType
  provider: InboundProviderKey
  requestId: string
  at: string
  leadId?: string | null
  data?: unknown
}

// Mapa log-status → evento correspondente (documental; sem lógica de emissão).
export const LOG_STATUS_EVENT: Record<InboundLogStatus, InboundEventType> = {
  received:  'inbound.received',
  validated: 'inbound.validated',
  rejected:  'inbound.rejected',
  duplicate: 'inbound.duplicate.detected',
  created:   'inbound.lead.created',
  error:     'inbound.failed',
  replayed:  'inbound.replay.requested',
}
