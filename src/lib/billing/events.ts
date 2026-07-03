import type { PaymentProviderType } from './types'

// Contratos de EVENTOS de pagamento/cobrança (CLIENT-005). Tipos PUROS — nenhum publisher, nenhuma
// integração. Prontos para o Event Bus / Automation Engine futuros (IA/Reporting consomem sem refatorar).
export type PaymentEventType =
  | 'payment.confirmed' | 'payment.failed' | 'payment.refunded' | 'payment.chargeback'
  | 'payment.invoice.created' | 'payment.invoice.paid'
  | 'payment.subscription.created' | 'payment.subscription.updated' | 'payment.subscription.canceled'
  | 'billing.provider.connected' | 'billing.provider.disconnected'
  | 'billing.sync.completed' | 'billing.sync.failed'

export type PaymentEvent<TPayload = unknown> = {
  type: PaymentEventType
  provider: PaymentProviderType
  clientId: string
  at: string           // ISO
  payload: TPayload
}

// Lista canônica (para docs/registradores futuros). Sem efeito colateral.
export const PAYMENT_EVENT_TYPES: PaymentEventType[] = [
  'payment.confirmed', 'payment.failed', 'payment.refunded', 'payment.chargeback',
  'payment.invoice.created', 'payment.invoice.paid',
  'payment.subscription.created', 'payment.subscription.updated', 'payment.subscription.canceled',
  'billing.provider.connected', 'billing.provider.disconnected',
  'billing.sync.completed', 'billing.sync.failed',
]
