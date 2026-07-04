// Fundação da CENTRAL DE INTEGRAÇÕES (INT-001, evolui PREINTEGRATION-001). Contratos PUROS — nenhuma API,
// OAuth, webhook, secret ou banco. Toda integração futura (Meta/Google/Stripe/WhatsApp/OpenAI/Claude/Make…)
// é um PROVIDER que segue este padrão; o sistema NÃO se acopla a nenhum. Coexiste com as integrações reais de
// hoje (Magnetic em /api/leads/inbound; Google Agenda em /api/google/oauth) — nunca as reescreve (INT-001).

// ── Providers ────────────────────────────────────────────────────────────────
export type IntegrationProviderKey =
  // marketing
  | 'meta_ads' | 'google_ads' | 'ga4' | 'gtm' | 'search_console' | 'tiktok_ads' | 'linkedin_ads'
  // crm / inbound
  | 'magnetic'
  // financeiro
  | 'stripe'
  // comunicação
  | 'google_calendar' | 'gmail' | 'outlook' | 'whatsapp' | 'zapi' | 'evolution'
  // ia
  | 'openai' | 'claude'
  // automação
  | 'make' | 'n8n'
  // webhooks
  | 'custom_webhook'

// Categoria TÉCNICA (granular) — preservada para os consumidores atuais (Tráfego › Contas, Cliente ›
// Integrações usam ['ads','analytics','payments','messaging']). Novos valores são ADITIVOS.
export type IntegrationCategory =
  | 'payments' | 'ads' | 'analytics' | 'messaging' | 'automation'
  | 'crm' | 'calendar' | 'email' | 'ai' | 'webhooks'

// Domínio de PRODUTO (as abas da Central). Derivado da categoria (CATEGORY_DOMAIN no catálogo).
export type IntegrationDomain =
  | 'marketing' | 'crm' | 'finance' | 'communication' | 'ai' | 'automation' | 'webhooks'

// Como o provider autentica. Um provider pode suportar mais de um modo (supportsOAuth/ApiKey/Webhook);
// authType é o modo PRINCIPAL/recomendado.
export type IntegrationAuthType = 'oauth' | 'api_key' | 'webhook' | 'manual'

export type IntegrationStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired'

// Saúde do provider (INT-001). Os 7 estados oficiais — labels/tons ficam em health.ts.
export type IntegrationHealthState =
  | 'healthy' | 'warning' | 'offline' | 'auth_error' | 'rate_limit' | 'config_error' | 'unknown'

export type IntegrationEnvironment = 'sandbox' | 'production'

// Escopo multi-tenant (TEAM-001) + opcional por cliente — a MESMA conexão serve global e por cliente.
export type IntegrationScope = { teamId: string; clientId?: string }

export type ProviderCapability = { key: string; label: string }

export type ProviderHealth = { ok: boolean; state: IntegrationHealthState; checkedAt: string | null; message: string | null }

// Coexistência: quando um provider JÁ opera por uma superfície legada (Magnetic → Webhooks de Entrada;
// Google → Conta Google), apontamos para lá em vez de fingir "conectado" aqui. Honestidade (INT-001).
export type IntegrationManagedVia = { label: string; href?: string } | null

// Definição ESTÁTICA do provider (catálogo): o que ele É, como autentica e o que sabe fazer.
export type IntegrationProvider = {
  key: IntegrationProviderKey
  name: string
  monogram: string                       // "logo" textual (sem imagem externa — CSP/asset-free)
  category: IntegrationCategory
  domain: IntegrationDomain
  description: string
  authType: IntegrationAuthType
  version: string                        // versão do conector (ex.: '1.0')
  capabilities: ProviderCapability[]
  scopes: string[]                       // permissões/escopos necessários (futuro OAuth)
  environments: IntegrationEnvironment[]
  docsUrl: string | null
  managedVia: IntegrationManagedVia      // superfície real onde já opera hoje (ou null)
  // Capacidades declaradas (INT-001): guiam a UI e o wiring futuro. Nada é executado.
  supportsOAuth: boolean
  supportsApiKey: boolean
  supportsWebhook: boolean
  supportsRealtime: boolean
  supportsImport: boolean                // leitura/importação de dados do provider
  supportsExport: boolean                // escrita/exportação de dados para o provider
  supportsHealthCheck: boolean
}

// Estado RUNTIME de uma conexão (futuro; hoje sempre 'disconnected' — sem persistência nesta camada).
export type IntegrationConnection = {
  provider: IntegrationProviderKey
  scope: IntegrationScope
  status: IntegrationStatus
  environment: IntegrationEnvironment | null
  lastSyncAt: string | null
  lastError: string | null
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
