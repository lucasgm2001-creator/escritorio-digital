import 'server-only'

export type IntegrationErrorCode =
  | 'integration_disabled'
  | 'not_implemented'
  | 'unauthorized'
  | 'invalid_request'
  | 'invalid_state'
  | 'invalid_signature'
  | 'missing_configuration'
  | 'rate_limited'
  | 'storage_error'

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode
  readonly status: number

  constructor(code: IntegrationErrorCode, message: string, status = 400) {
    super(message)
    this.name = 'IntegrationError'
    this.code = code
    this.status = status
  }
}

export function integrationDisabled(provider: string): IntegrationError {
  return new IntegrationError('integration_disabled', `${provider} está desativado por feature flag.`, 503)
}

export function integrationNotImplemented(provider: string): IntegrationError {
  return new IntegrationError('not_implemented', `${provider} ainda não possui conector de produção.`, 501)
}
