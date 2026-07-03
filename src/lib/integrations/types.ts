// Camada GENÉRICA de pré-integração (PREINTEGRATION-001). Contratos PUROS — nenhuma API/OAuth/webhook/
// secret/banco. Toda integração futura (Stripe/Meta/Google/GA4/Search Console/WhatsApp/Make/N8N) é um
// PROVIDER que segue este padrão. O sistema NÃO se acopla a nenhum provider específico.

export type IntegrationProviderKey =
  | 'stripe' | 'meta_ads' | 'google_ads' | 'ga4' | 'search_console'
  | 'tiktok_ads' | 'linkedin_ads' | 'whatsapp' | 'make' | 'n8n'

export type IntegrationCategory = 'payments' | 'ads' | 'analytics' | 'messaging' | 'automation'

export type IntegrationStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired'

export type IntegrationEnvironment = 'sandbox' | 'production'

// Escopo multi-tenant (TEAM-001) + opcional por cliente — a MESMA conexão serve global e por cliente.
export type IntegrationScope = { teamId: string; clientId?: string }

export type ProviderCapability = { key: string; label: string }

export type ProviderHealth = { ok: boolean; checkedAt: string | null; message: string | null }

// Definição ESTÁTICA do provider (catálogo): o que ele É e o que precisa.
export type IntegrationProvider = {
  key: IntegrationProviderKey
  name: string
  monogram: string
  category: IntegrationCategory
  description: string
  capabilities: ProviderCapability[]
  scopes: string[]                       // permissões/escopos necessários (futuro OAuth)
  environments: IntegrationEnvironment[]
  docsUrl: string | null
}

// Estado RUNTIME de uma conexão (futuro; hoje sempre 'disconnected').
export type IntegrationConnection = {
  provider: IntegrationProviderKey
  scope: IntegrationScope
  status: IntegrationStatus
  environment: IntegrationEnvironment | null
  lastSyncAt: string | null
  externalAccountId: string | null
  health: ProviderHealth | null
}

export type IntegrationSyncJob = {
  id: string
  provider: IntegrationProviderKey
  scope: IntegrationScope
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'completed' | 'failed'
}

export type IntegrationSyncLog = {
  id: string
  jobId: string
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export type IntegrationWebhookEvent = {
  id: string
  provider: IntegrationProviderKey
  type: string
  receivedAt: string
  processed: boolean
  payload: unknown
}
