import type {
  IntegrationCategory, IntegrationDomain, IntegrationProvider,
} from './types'

// Catálogo ESTÁTICO dos providers da Central de Integrações (INT-001). Só metadados — NADA conecta, nada
// autentica, nada chama API. Cada provider declara identidade, autenticação, capacidades e a superfície onde
// já opera hoje (managedVia), quando existir. Expande PREINTEGRATION-001 sem quebrar os consumidores atuais.

// Atalho: monta um provider preenchendo os defaults de capacidade (tudo false salvo o que for passado).
type ProviderSeed = Omit<IntegrationProvider,
  'supportsOAuth' | 'supportsApiKey' | 'supportsWebhook' | 'supportsRealtime' | 'supportsImport' | 'supportsExport' | 'supportsHealthCheck'
> & Partial<Pick<IntegrationProvider,
  'supportsOAuth' | 'supportsApiKey' | 'supportsWebhook' | 'supportsRealtime' | 'supportsImport' | 'supportsExport' | 'supportsHealthCheck'
>>

function provider(seed: ProviderSeed): IntegrationProvider {
  return {
    supportsOAuth: false, supportsApiKey: false, supportsWebhook: false, supportsRealtime: false,
    supportsImport: false, supportsExport: false, supportsHealthCheck: false,
    ...seed,
  }
}

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  // ── Marketing ────────────────────────────────────────────────────────────
  provider({
    key: 'meta_ads', name: 'Meta Ads', monogram: 'M', category: 'ads', domain: 'marketing', authType: 'oauth', version: '1.0',
    description: 'Contas, campanhas, conjuntos, anúncios, criativos, insights, leads e Conversions API.',
    capabilities: [{ key: 'campaigns', label: 'Campanhas' }, { key: 'insights', label: 'Insights' }, { key: 'leads', label: 'Leads' }, { key: 'capi', label: 'Conversions API' }],
    scopes: ['ads_read', 'ads_management', 'leads_retrieval'], environments: ['production'], docsUrl: 'https://developers.facebook.com/docs/marketing-apis', managedVia: null,
    supportsOAuth: true, supportsWebhook: true, supportsRealtime: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'google_ads', name: 'Google Ads', monogram: 'GA', category: 'ads', domain: 'marketing', authType: 'oauth', version: '1.0',
    description: 'Contas, campanhas, grupos, anúncios, conversões, keywords e performance.',
    capabilities: [{ key: 'campaigns', label: 'Campanhas' }, { key: 'conversions', label: 'Conversões' }, { key: 'keywords', label: 'Keywords' }],
    scopes: ['https://www.googleapis.com/auth/adwords'], environments: ['production'], docsUrl: 'https://developers.google.com/google-ads/api/docs/start', managedVia: null,
    supportsOAuth: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'ga4', name: 'Google Analytics 4', monogram: 'A4', category: 'analytics', domain: 'marketing', authType: 'oauth', version: '1.0',
    description: 'Usuários, sessões, eventos, origens, páginas e conversões.',
    capabilities: [{ key: 'users', label: 'Usuários' }, { key: 'events', label: 'Eventos' }, { key: 'sources', label: 'Origens' }],
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'], environments: ['production'], docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1', managedVia: null,
    supportsOAuth: true, supportsImport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'gtm', name: 'Google Tag Manager', monogram: 'TM', category: 'analytics', domain: 'marketing', authType: 'oauth', version: '1.0',
    description: 'Contêineres, tags, gatilhos e variáveis de rastreamento do site.',
    capabilities: [{ key: 'containers', label: 'Contêineres' }, { key: 'tags', label: 'Tags' }, { key: 'triggers', label: 'Gatilhos' }],
    scopes: ['https://www.googleapis.com/auth/tagmanager.readonly'], environments: ['production'], docsUrl: 'https://developers.google.com/tag-platform/tag-manager/api/v2', managedVia: null,
    supportsOAuth: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'search_console', name: 'Search Console', monogram: 'SC', category: 'analytics', domain: 'marketing', authType: 'oauth', version: '1.0',
    description: 'Queries, cliques, impressões e posição média.',
    capabilities: [{ key: 'queries', label: 'Queries' }, { key: 'clicks', label: 'Cliques' }, { key: 'position', label: 'Posição média' }],
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'], environments: ['production'], docsUrl: 'https://developers.google.com/webmaster-tools', managedVia: null,
    supportsOAuth: true, supportsImport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'tiktok_ads', name: 'TikTok Ads', monogram: 'TT', category: 'ads', domain: 'marketing', authType: 'oauth', version: '1.0',
    description: 'Campanhas, criativos e insights de vídeo do TikTok.',
    capabilities: [{ key: 'campaigns', label: 'Campanhas' }, { key: 'creatives', label: 'Criativos' }, { key: 'insights', label: 'Insights' }],
    scopes: ['ads.read'], environments: ['production'], docsUrl: 'https://business-api.tiktok.com/portal/docs', managedVia: null,
    supportsOAuth: true, supportsImport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'linkedin_ads', name: 'LinkedIn Ads', monogram: 'in', category: 'ads', domain: 'marketing', authType: 'oauth', version: '1.0',
    description: 'Campanhas B2B segmentadas por cargo e empresa.',
    capabilities: [{ key: 'campaigns', label: 'Campanhas' }, { key: 'insights', label: 'Insights' }],
    scopes: ['r_ads', 'r_ads_reporting'], environments: ['production'], docsUrl: 'https://learn.microsoft.com/linkedin/marketing', managedVia: null,
    supportsOAuth: true, supportsImport: true, supportsHealthCheck: true,
  }),

  // ── CRM / Inbound ────────────────────────────────────────────────────────
  provider({
    key: 'magnetic', name: 'Magnetic Funnels', monogram: 'MF', category: 'crm', domain: 'crm', authType: 'webhook', version: '1.0',
    description: 'Funis/formulários (GoHighLevel). Cada lead novo entra no funil do Comercial.',
    capabilities: [{ key: 'leads', label: 'Leads' }, { key: 'forms', label: 'Formulários' }, { key: 'utm', label: 'UTM' }],
    scopes: [], environments: ['production'], docsUrl: null,
    managedVia: { label: 'Webhooks de Entrada', href: '/admin/inbound' },
    supportsWebhook: true, supportsRealtime: true, supportsImport: true, supportsHealthCheck: true,
  }),

  // ── Financeiro ─────────────────────────────────────────────────────────────
  provider({
    key: 'stripe', name: 'Stripe', monogram: 'S', category: 'payments', domain: 'finance', authType: 'api_key', version: '1.0',
    description: 'Pagamentos, invoices, assinaturas, payment intents, chargebacks e refunds.',
    capabilities: [{ key: 'payments', label: 'Pagamentos' }, { key: 'invoices', label: 'Invoices' }, { key: 'subscriptions', label: 'Assinaturas' }, { key: 'webhooks', label: 'Webhooks' }],
    scopes: ['charges:read', 'customers:read', 'subscriptions:read', 'invoices:read'], environments: ['sandbox', 'production'], docsUrl: 'https://stripe.com/docs/api', managedVia: null,
    supportsApiKey: true, supportsWebhook: true, supportsRealtime: true, supportsImport: true, supportsHealthCheck: true,
  }),

  // ── Comunicação ────────────────────────────────────────────────────────────
  provider({
    key: 'google_calendar', name: 'Google Calendar', monogram: 'GC', category: 'calendar', domain: 'communication', authType: 'oauth', version: '1.0',
    description: 'Eventos, reuniões e Google Meet — sincronização da Agenda como o próprio usuário.',
    capabilities: [{ key: 'events', label: 'Eventos' }, { key: 'meet', label: 'Google Meet' }, { key: 'sync', label: 'Sincronização' }],
    scopes: ['https://www.googleapis.com/auth/calendar.events', 'openid', 'email'], environments: ['production'], docsUrl: 'https://developers.google.com/calendar/api',
    managedVia: { label: 'Conta Google (Agenda)' },
    supportsOAuth: true, supportsRealtime: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'gmail', name: 'Gmail', monogram: 'Gm', category: 'email', domain: 'communication', authType: 'oauth', version: '1.0',
    description: 'Envio e leitura de e-mails, threads e rótulos da conta Google.',
    capabilities: [{ key: 'send', label: 'Envio' }, { key: 'threads', label: 'Threads' }, { key: 'labels', label: 'Rótulos' }],
    scopes: ['https://www.googleapis.com/auth/gmail.modify'], environments: ['production'], docsUrl: 'https://developers.google.com/gmail/api', managedVia: null,
    supportsOAuth: true, supportsWebhook: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'outlook', name: 'Outlook', monogram: 'Ou', category: 'email', domain: 'communication', authType: 'oauth', version: '1.0',
    description: 'E-mails e calendário via Microsoft Graph (Microsoft 365).',
    capabilities: [{ key: 'mail', label: 'E-mail' }, { key: 'calendar', label: 'Calendário' }],
    scopes: ['Mail.ReadWrite', 'Calendars.ReadWrite'], environments: ['production'], docsUrl: 'https://learn.microsoft.com/graph/api/overview', managedVia: null,
    supportsOAuth: true, supportsWebhook: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'whatsapp', name: 'WhatsApp Business', monogram: 'WA', category: 'messaging', domain: 'communication', authType: 'api_key', version: '1.0',
    description: 'Mensagens, conversas, templates, status e leads (Cloud API oficial).',
    capabilities: [{ key: 'messages', label: 'Mensagens' }, { key: 'templates', label: 'Templates' }, { key: 'status', label: 'Status' }],
    scopes: ['whatsapp_business_messaging'], environments: ['sandbox', 'production'], docsUrl: 'https://developers.facebook.com/docs/whatsapp', managedVia: null,
    supportsApiKey: true, supportsWebhook: true, supportsRealtime: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'zapi', name: 'Z-API', monogram: 'Z', category: 'messaging', domain: 'communication', authType: 'api_key', version: '1.0',
    description: 'WhatsApp não-oficial via Z-API: instâncias, mensagens e webhooks.',
    capabilities: [{ key: 'messages', label: 'Mensagens' }, { key: 'instances', label: 'Instâncias' }, { key: 'webhooks', label: 'Webhooks' }],
    scopes: [], environments: ['production'], docsUrl: 'https://developer.z-api.io', managedVia: null,
    supportsApiKey: true, supportsWebhook: true, supportsRealtime: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'evolution', name: 'Evolution API', monogram: 'Ev', category: 'messaging', domain: 'communication', authType: 'api_key', version: '1.0',
    description: 'WhatsApp via Evolution API self-hosted: instâncias, mensagens e eventos.',
    capabilities: [{ key: 'messages', label: 'Mensagens' }, { key: 'instances', label: 'Instâncias' }, { key: 'webhooks', label: 'Webhooks' }],
    scopes: [], environments: ['sandbox', 'production'], docsUrl: 'https://doc.evolution-api.com', managedVia: null,
    supportsApiKey: true, supportsWebhook: true, supportsRealtime: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),

  // ── IA ─────────────────────────────────────────────────────────────────────
  provider({
    key: 'openai', name: 'OpenAI', monogram: 'AI', category: 'ai', domain: 'ai', authType: 'api_key', version: '1.0',
    description: 'Modelos GPT para geração de texto, embeddings e análise.',
    capabilities: [{ key: 'chat', label: 'Chat' }, { key: 'embeddings', label: 'Embeddings' }, { key: 'vision', label: 'Visão' }],
    scopes: [], environments: ['production'], docsUrl: 'https://platform.openai.com/docs', managedVia: null,
    supportsApiKey: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'claude', name: 'Claude (Anthropic)', monogram: 'Cl', category: 'ai', domain: 'ai', authType: 'api_key', version: '1.0',
    description: 'Modelos Claude para geração, análise e resumo com contexto longo.',
    capabilities: [{ key: 'messages', label: 'Mensagens' }, { key: 'vision', label: 'Visão' }, { key: 'tools', label: 'Ferramentas' }],
    scopes: [], environments: ['production'], docsUrl: 'https://docs.anthropic.com', managedVia: null,
    supportsApiKey: true, supportsExport: true, supportsHealthCheck: true,
  }),

  // ── Automação ────────────────────────────────────────────────────────────
  provider({
    key: 'make', name: 'Make', monogram: 'Mk', category: 'automation', domain: 'automation', authType: 'webhook', version: '1.0',
    description: 'Webhooks externos, automações, gatilhos, ações e logs.',
    capabilities: [{ key: 'webhooks', label: 'Webhooks' }, { key: 'triggers', label: 'Gatilhos' }, { key: 'actions', label: 'Ações' }],
    scopes: [], environments: ['production'], docsUrl: 'https://www.make.com/en/help/apps', managedVia: null,
    supportsWebhook: true, supportsRealtime: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
  provider({
    key: 'n8n', name: 'n8n', monogram: 'N8', category: 'automation', domain: 'automation', authType: 'webhook', version: '1.0',
    description: 'Workflows self-hosted: webhooks, gatilhos, ações e logs.',
    capabilities: [{ key: 'webhooks', label: 'Webhooks' }, { key: 'triggers', label: 'Gatilhos' }, { key: 'actions', label: 'Ações' }],
    scopes: [], environments: ['sandbox', 'production'], docsUrl: 'https://docs.n8n.io', managedVia: null,
    supportsWebhook: true, supportsRealtime: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),

  // ── Webhooks ─────────────────────────────────────────────────────────────
  provider({
    key: 'custom_webhook', name: 'Webhooks Customizados', monogram: 'WH', category: 'webhooks', domain: 'webhooks', authType: 'webhook', version: '1.0',
    description: 'Endpoint universal para qualquer ferramenta que envie JSON. Você mapeia os campos ao ligar.',
    capabilities: [{ key: 'inbound', label: 'Entrada' }, { key: 'outbound', label: 'Saída' }, { key: 'events', label: 'Eventos' }],
    scopes: [], environments: ['sandbox', 'production'], docsUrl: null, managedVia: null,
    supportsWebhook: true, supportsRealtime: true, supportsImport: true, supportsExport: true, supportsHealthCheck: true,
  }),
]

// Categoria técnica → domínio de produto (aba). Fonte única do agrupamento das abas.
export const CATEGORY_DOMAIN: Record<IntegrationCategory, IntegrationDomain> = {
  ads: 'marketing', analytics: 'marketing',
  crm: 'crm',
  payments: 'finance',
  calendar: 'communication', email: 'communication', messaging: 'communication',
  ai: 'ai',
  automation: 'automation',
  webhooks: 'webhooks',
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  payments: 'Pagamentos', ads: 'Anúncios', analytics: 'Analytics', messaging: 'Mensagens', automation: 'Automação',
  crm: 'CRM', calendar: 'Agenda', email: 'E-mail', ai: 'IA', webhooks: 'Webhooks',
}

export const DOMAIN_LABELS: Record<IntegrationDomain, string> = {
  marketing: 'Marketing', crm: 'CRM', finance: 'Financeiro', communication: 'Comunicação',
  ai: 'IA', automation: 'Automação', webhooks: 'Webhooks',
}

// Filtro por categoria TÉCNICA — preservado para os consumidores atuais (Tráfego › Contas, Cliente › Integrações).
export function integrationsByCategory(categories: IntegrationCategory[]): IntegrationProvider[] {
  return INTEGRATION_PROVIDERS.filter(provider => categories.includes(provider.category))
}

// Filtro por DOMÍNIO de produto (as abas da Central).
export function providersByDomain(domain: IntegrationDomain): IntegrationProvider[] {
  return INTEGRATION_PROVIDERS.filter(provider => provider.domain === domain)
}

export function getIntegrationProvider(key: string): IntegrationProvider | undefined {
  return INTEGRATION_PROVIDERS.find(provider => provider.key === key)
}
