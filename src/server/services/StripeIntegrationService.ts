import { integrationNotImplemented } from '@/server/integrations/errors'
import type { HardenedIntegrationProvider } from '@/server/integrations/feature-flags'
import { integrationLog } from '@/server/integrations/logger'

export interface StripeEventPayload {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

export class StripeIntegrationService {
  private static readonly provider: HardenedIntegrationProvider = 'stripe'

  /**
   * Infra preparada para dispatcher/idempotência/retry, mas sem conector real.
   * Enquanto a assinatura do Stripe e o mapeamento tenant/customer não existirem, falha fechado.
   */
  static async handleWebhook(payload: StripeEventPayload, requestId: string): Promise<never> {
    integrationLog('warn', {
      provider: this.provider,
      requestId,
      eventId: payload.id,
      action: 'webhook.dispatch',
    }, 'Stripe webhook recebido, mas o conector de produção ainda não está implementado.', {
      type: payload.type,
    })
    throw integrationNotImplemented('Stripe')
  }

  /**
   * Placeholder seguro para Checkout. Não cria sessão nem chama API externa.
   */
  static async createCheckoutSession(): Promise<never> {
    throw integrationNotImplemented('Stripe Checkout')
  }

  /**
   * Placeholder seguro para Portal do Cliente. Não cria sessão nem chama API externa.
   */
  static async createCustomerPortalSession(): Promise<never> {
    throw integrationNotImplemented('Stripe Portal')
  }

  /**
   * Dispatcher futuro: checkout, customer, subscription, invoice, portal, retry e event log.
   */
  static supportedEvents(): string[] {
    return [
      'checkout.session.completed',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
    ]
  }
}
