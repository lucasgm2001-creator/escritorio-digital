import 'server-only'

import type { IntegrationProviderKey } from '@/lib/integrations/types'

export type HardenedIntegrationProvider = Extract<
  IntegrationProviderKey,
  'stripe' | 'google_ads' | 'meta_ads' | 'whatsapp'
>

type IntegrationFlag = {
  provider: HardenedIntegrationProvider
  env: string
  owner: string
  enabled: boolean
  lifecycle: 'prepared' | 'active'
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

function readBool(name: string): boolean {
  return TRUE_VALUES.has((process.env[name] ?? '').trim().toLowerCase())
}

export const INTEGRATION_FLAGS: Record<HardenedIntegrationProvider, IntegrationFlag> = {
  stripe: {
    provider: 'stripe',
    env: 'INTEGRATION_STRIPE_ENABLED',
    owner: 'backend-security',
    enabled: readBool('INTEGRATION_STRIPE_ENABLED'),
    lifecycle: 'prepared',
  },
  google_ads: {
    provider: 'google_ads',
    env: 'INTEGRATION_GOOGLE_ADS_ENABLED',
    owner: 'backend-security',
    enabled: readBool('INTEGRATION_GOOGLE_ADS_ENABLED'),
    lifecycle: 'prepared',
  },
  meta_ads: {
    provider: 'meta_ads',
    env: 'INTEGRATION_META_ADS_ENABLED',
    owner: 'backend-security',
    enabled: readBool('INTEGRATION_META_ADS_ENABLED'),
    lifecycle: 'prepared',
  },
  whatsapp: {
    provider: 'whatsapp',
    env: 'INTEGRATION_WHATSAPP_ENABLED',
    owner: 'backend-security',
    enabled: readBool('INTEGRATION_WHATSAPP_ENABLED'),
    lifecycle: 'prepared',
  },
}

export function integrationFlag(provider: HardenedIntegrationProvider): IntegrationFlag {
  return INTEGRATION_FLAGS[provider]
}

export function isIntegrationEnabled(provider: HardenedIntegrationProvider): boolean {
  return integrationFlag(provider).enabled
}
