// Contratos PUROS de provedor de pagamento (CLIENT-005). NENHUMA integração/API/banco/Stripe — só tipos,
// para o futuro plugar Stripe/Asaas/Mercado Pago/PayPal/manual SEM acoplar o domínio financeiro a um
// provider específico. O provedor é um Provider; o centro continua sendo o Financeiro (client_payments).

export type PaymentProviderType = 'manual' | 'stripe' | 'asaas' | 'mercado_pago' | 'paypal'

export type PaymentSyncStatus = 'nunca' | 'sincronizado' | 'pendente' | 'erro'

export type PaymentMethodKind = 'card' | 'pix' | 'boleto' | 'bank_transfer' | 'manual'

// Status normalizado de um pagamento (mapeável a partir do Stripe e de outros providers).
export type PaymentStatus =
  | 'requires_action' | 'processing' | 'succeeded' | 'canceled'
  | 'failed' | 'refunded' | 'chargeback' | 'manual'

// Nome preservado por compatibilidade com o pedido (Stripe é só um caso de PaymentStatus).
export type StripePaymentStatus = PaymentStatus

// Referência externa (ids no provider) — desacopla o domínio do Stripe.
export type ExternalPaymentReference = {
  provider: PaymentProviderType
  customerId: string | null        // ex.: Stripe customer id
  subscriptionId: string | null    // ex.: Stripe subscription id
  paymentIntentId: string | null   // ex.: Stripe payment intent
  invoiceId: string | null
}

export type PaymentMethodSummary = {
  kind: PaymentMethodKind
  brand: string | null             // ex.: 'visa'
  last4: string | null
  label: string                    // rótulo pronto p/ UI (ex.: 'Manual', 'Visa •••• 4242')
}

export type PaymentProvider = {
  type: PaymentProviderType
  connected: boolean
  lastSyncAt: string | null
  syncStatus: PaymentSyncStatus
  webhookOk: boolean
}

// Perfil de cobrança do cliente (agnóstico de provider).
export type CustomerBillingProfile = {
  provider: PaymentProvider
  method: PaymentMethodSummary | null
  reference: ExternalPaymentReference | null
  lastConfirmationAt: string | null
}

// Evento cru recebido de um webhook de provider (contrato — sem receiver real nesta fase).
export type PaymentWebhookEvent = {
  id: string
  provider: PaymentProviderType
  type: string           // ver billing/events (PaymentEventType)
  receivedAt: string     // ISO
  payload: unknown
}
