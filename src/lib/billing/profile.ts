import type { CustomerBillingProfile } from './types'

// Perfil de cobrança ATUAL do cliente. Hoje a cobrança é 100% MANUAL (client_payments); nenhum provedor
// (Stripe/Asaas/…) conectado. Placeholder honesto — quando existir provider real, um Service preenche isto
// a partir da referência externa, SEM mudar a UI (a UI já lê CustomerBillingProfile).
export function currentBillingProfile(): CustomerBillingProfile {
  return {
    provider: { type: 'manual', connected: false, lastSyncAt: null, syncStatus: 'nunca', webhookOk: false },
    method: { kind: 'manual', brand: null, last4: null, label: 'Manual' },
    reference: null,
    lastConfirmationAt: null,
  }
}
