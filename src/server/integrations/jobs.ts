import 'server-only'

import type { HardenedIntegrationProvider } from './feature-flags'
import { DEFAULT_INTEGRATION_RETRY, type RetryPolicy } from './retry'

export type IntegrationJobKind =
  | 'oauth.refresh_token'
  | 'accounts.sync'
  | 'campaigns.sync'
  | 'metrics.sync'
  | 'webhook.dispatch'
  | 'message.status.sync'

export type IntegrationJobDescriptor = {
  provider: HardenedIntegrationProvider
  kind: IntegrationJobKind
  queue: 'integrations'
  retry: RetryPolicy
  rateLimitKey: string
}

export function integrationJob(provider: HardenedIntegrationProvider, kind: IntegrationJobKind): IntegrationJobDescriptor {
  return {
    provider,
    kind,
    queue: 'integrations',
    retry: DEFAULT_INTEGRATION_RETRY,
    rateLimitKey: `${provider}:${kind}`,
  }
}
