import { NextResponse } from 'next/server'
import { IntegrationError, integrationNotImplemented } from '@/server/integrations/errors'
import { isIntegrationEnabled } from '@/server/integrations/feature-flags'
import { integrationJsonError } from '@/server/integrations/http'
import { createRequestId, integrationLog } from '@/server/integrations/logger'
import { timingSafeStringEqual } from '@/server/integrations/security'
import { verifySha256Signature } from '@/server/integrations/webhook-security'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const requestId = createRequestId()
  const logContext = { provider: 'whatsapp' as const, requestId, action: 'webhook.verify' }

  try {
    if (!isIntegrationEnabled('whatsapp')) {
      throw new IntegrationError('integration_disabled', 'WhatsApp webhook está desativado por feature flag.', 503)
    }

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
    if (!verifyToken) {
      throw new IntegrationError('missing_configuration', 'WHATSAPP_VERIFY_TOKEN não configurado.', 500)
    }

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token && challenge && timingSafeStringEqual(token, verifyToken)) {
      return new Response(challenge, { status: 200 })
    }

    throw new IntegrationError('invalid_signature', 'Token de verificação inválido.', 403)
  } catch (err) {
    return integrationJsonError(err, logContext)
  }
}

export async function POST(req: Request) {
  const requestId = createRequestId()
  const logContext = { provider: 'whatsapp' as const, requestId, action: 'webhook.receive' }

  try {
    if (!isIntegrationEnabled('whatsapp')) {
      throw new IntegrationError('integration_disabled', 'WhatsApp webhook está desativado por feature flag.', 503)
    }

    const rawBody = await req.text()
    verifySha256Signature({
      rawBody,
      signatureHeader: req.headers.get('x-hub-signature-256'),
      secret: process.env.WHATSAPP_APP_SECRET,
      prefix: 'sha256=',
      providerLabel: 'WhatsApp',
    })

    const payload = JSON.parse(rawBody) as { entry?: unknown[] }
    integrationLog('warn', logContext, 'WhatsApp webhook validado, mas o dispatcher real ainda não está implementado.', {
      hasEntry: Array.isArray(payload.entry),
    })

    throw integrationNotImplemented('WhatsApp webhook dispatcher')
  } catch (err) {
    return integrationJsonError(err, logContext)
  }
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true })
}
