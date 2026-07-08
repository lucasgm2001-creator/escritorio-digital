import { NextResponse } from 'next/server'
import { StripeIntegrationService } from '@/server/services/StripeIntegrationService'
import { IntegrationError } from '@/server/integrations/errors'
import { isIntegrationEnabled } from '@/server/integrations/feature-flags'
import { integrationJsonError } from '@/server/integrations/http'
import { createRequestId } from '@/server/integrations/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const requestId = createRequestId()
  const context = { provider: 'stripe' as const, requestId, action: 'webhook.receive' }
  try {
    if (!isIntegrationEnabled('stripe')) {
      throw new IntegrationError('integration_disabled', 'Stripe webhook está desativado por feature flag.', 503)
    }

    const signature = req.headers.get('stripe-signature')
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new IntegrationError('invalid_signature', 'Stripe webhook sem assinatura/configuração válida.', 400)
    }

    const rawBody = await req.text()
    const payload = JSON.parse(rawBody) as { id?: string; type?: string; data?: { object?: Record<string, unknown> } }
    if (!payload.id || !payload.type) {
      throw new IntegrationError('invalid_request', 'Payload Stripe inválido.', 400)
    }

    await StripeIntegrationService.handleWebhook({
      id: payload.id,
      type: payload.type,
      data: { object: payload.data?.object ?? {} }
    }, requestId)

    return NextResponse.json({ received: true })
  } catch (err) {
    return integrationJsonError(err, context)
  }
}
