import 'server-only'

import type { HardenedIntegrationProvider } from './feature-flags'

export type IntegrationCacheKeyInput = {
  provider: HardenedIntegrationProvider
  teamId: string
  clientId?: string | null
  resource: 'accounts' | 'campaigns' | 'metrics' | 'webhook_event'
  date?: string | null
}

export function integrationCacheKey(input: IntegrationCacheKeyInput): string {
  return [
    'integration',
    input.provider,
    input.teamId,
    input.clientId ?? 'team',
    input.resource,
    input.date ?? 'latest',
  ].join(':')
}
