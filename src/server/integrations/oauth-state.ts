import 'server-only'

import type { HardenedIntegrationProvider } from './feature-flags'
import { hmacSha256, randomNonce, timingSafeStringEqual } from './security'
import { IntegrationError } from './errors'

export type SignedOAuthState = {
  provider: HardenedIntegrationProvider
  teamId: string
  userId: string
  nonce: string
  issuedAt: number
  expiresAt: number
  redirectPath: string
}

const STATE_TTL_MS = 10 * 60 * 1000

function stateSecret(): string {
  const secret = process.env.INTEGRATION_OAUTH_STATE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new IntegrationError('missing_configuration', 'Secret de OAuth state não configurado.', 500)
  }
  return secret
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
}

export function createOAuthState(input: {
  provider: HardenedIntegrationProvider
  teamId: string
  userId: string
  redirectPath?: string
}): string {
  const now = Date.now()
  const payload: SignedOAuthState = {
    provider: input.provider,
    teamId: input.teamId,
    userId: input.userId,
    nonce: randomNonce(),
    issuedAt: now,
    expiresAt: now + STATE_TTL_MS,
    redirectPath: input.redirectPath ?? '/configuracoes',
  }
  const body = encodeJson(payload)
  return `${body}.${hmacSha256(body, stateSecret())}`
}

export function verifyOAuthState(raw: string | null): SignedOAuthState {
  if (!raw) throw new IntegrationError('invalid_state', 'OAuth state ausente.', 400)
  const [body, signature, extra] = raw.split('.')
  if (!body || !signature || extra) {
    throw new IntegrationError('invalid_state', 'OAuth state malformado.', 400)
  }
  const expected = hmacSha256(body, stateSecret())
  if (!timingSafeStringEqual(signature, expected)) {
    throw new IntegrationError('invalid_state', 'OAuth state inválido.', 400)
  }
  const state = decodeJson<SignedOAuthState>(body)
  if (!state.expiresAt || Date.now() > state.expiresAt) {
    throw new IntegrationError('invalid_state', 'OAuth state expirado.', 400)
  }
  return state
}
