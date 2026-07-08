import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { canAccessAdmin } from '@/lib/permissions/admin-access'
import { getRequestContext, type RequestContext } from '@/server/context/request-context'
import { IntegrationError } from './errors'
import type { HardenedIntegrationProvider } from './feature-flags'
import { integrationFlag } from './feature-flags'

export type IntegrationAccess = {
  context: RequestContext
  teamId: string
}

export async function requireIntegrationAdmin(provider: HardenedIntegrationProvider): Promise<IntegrationAccess> {
  const context = await getRequestContext()
  if (!context || !context.activeTeamId) {
    throw new IntegrationError('unauthorized', 'Sessão expirada ou equipe ativa ausente.', 401)
  }
  if (!canAccessAdmin(context)) {
    throw new IntegrationError('unauthorized', 'Você não tem permissão para gerenciar integrações.', 403)
  }
  const flag = integrationFlag(provider)
  if (!flag.enabled) {
    throw new IntegrationError('integration_disabled', `${provider} está desativado por feature flag (${flag.env}).`, 503)
  }
  return { context, teamId: context.activeTeamId }
}

export function assertSameActiveTeam(inputTeamId: string | null | undefined, activeTeamId: string): void {
  if (!inputTeamId || inputTeamId !== activeTeamId) {
    throw new IntegrationError('unauthorized', 'A integração só pode operar na equipe ativa.', 403)
  }
}

export function randomNonce(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

export function hmacSha256(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
