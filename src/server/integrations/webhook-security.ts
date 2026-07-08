import 'server-only'

import { createHmac } from 'crypto'
import { IntegrationError } from './errors'
import { timingSafeStringEqual } from './security'

export function verifySha256Signature(params: {
  rawBody: string
  signatureHeader: string | null
  secret: string | undefined
  prefix?: string
  providerLabel: string
}): void {
  if (!params.secret) {
    throw new IntegrationError('missing_configuration', `${params.providerLabel} webhook secret não configurado.`, 500)
  }
  if (!params.signatureHeader) {
    throw new IntegrationError('invalid_signature', `${params.providerLabel} webhook sem assinatura.`, 400)
  }

  const prefix = params.prefix ?? ''
  const digest = createHmac('sha256', params.secret).update(params.rawBody).digest('hex')
  const expected = `${prefix}${digest}`
  if (!timingSafeStringEqual(params.signatureHeader, expected)) {
    throw new IntegrationError('invalid_signature', `${params.providerLabel} webhook com assinatura inválida.`, 400)
  }
}
