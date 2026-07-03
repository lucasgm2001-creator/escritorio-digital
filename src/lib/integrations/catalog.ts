import type { IntegrationCategory, IntegrationProvider } from './types'

// Catálogo ESTÁTICO dos providers de integração (PREINTEGRATION-001). Só metadados — nada conecta.
export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    key: 'stripe', name: 'Stripe', monogram: 'S', category: 'payments',
    description: 'Pagamentos, invoices, assinaturas, payment intents, chargebacks e refunds.',
    capabilities: [{ key: 'payments', label: 'Pagamentos' }, { key: 'invoices', label: 'Invoices' }, { key: 'subscriptions', label: 'Assinaturas' }, { key: 'webhooks', label: 'Webhooks' }],
    scopes: ['charges:read', 'customers:read', 'subscriptions:read', 'invoices:read'], environments: ['sandbox', 'production'], docsUrl: null,
  },
  {
    key: 'meta_ads', name: 'Meta Ads', monogram: 'M', category: 'ads',
    description: 'Contas, campanhas, conjuntos, anúncios, criativos, insights, leads e Conversions API.',
    capabilities: [{ key: 'campaigns', label: 'Campanhas' }, { key: 'creatives', label: 'Criativos' }, { key: 'insights', label: 'Insights' }, { key: 'capi', label: 'Conversions API' }],
    scopes: ['ads_read', 'ads_management'], environments: ['production'], docsUrl: null,
  },
  {
    key: 'google_ads', name: 'Google Ads', monogram: 'G', category: 'ads',
    description: 'Contas, campanhas, grupos, anúncios, conversões, keywords e performance.',
    capabilities: [{ key: 'campaigns', label: 'Campanhas' }, { key: 'conversions', label: 'Conversões' }, { key: 'keywords', label: 'Keywords' }],
    scopes: ['adwords'], environments: ['production'], docsUrl: null,
  },
  {
    key: 'ga4', name: 'Google Analytics 4', monogram: 'GA', category: 'analytics',
    description: 'Usuários, sessões, eventos, origens, páginas e conversões.',
    capabilities: [{ key: 'users', label: 'Usuários' }, { key: 'events', label: 'Eventos' }, { key: 'sources', label: 'Origens' }],
    scopes: ['analytics.readonly'], environments: ['production'], docsUrl: null,
  },
  {
    key: 'search_console', name: 'Search Console', monogram: 'SC', category: 'analytics',
    description: 'Queries, cliques, impressões e posição média.',
    capabilities: [{ key: 'queries', label: 'Queries' }, { key: 'clicks', label: 'Cliques' }, { key: 'position', label: 'Posição média' }],
    scopes: ['webmasters.readonly'], environments: ['production'], docsUrl: null,
  },
  {
    key: 'tiktok_ads', name: 'TikTok Ads', monogram: 'TT', category: 'ads',
    description: 'Campanhas, criativos e insights de vídeo do TikTok.',
    capabilities: [{ key: 'campaigns', label: 'Campanhas' }, { key: 'creatives', label: 'Criativos' }],
    scopes: ['ads.read'], environments: ['production'], docsUrl: null,
  },
  {
    key: 'linkedin_ads', name: 'LinkedIn Ads', monogram: 'in', category: 'ads',
    description: 'Campanhas B2B segmentadas por cargo e empresa.',
    capabilities: [{ key: 'campaigns', label: 'Campanhas' }, { key: 'insights', label: 'Insights' }],
    scopes: ['r_ads', 'r_ads_reporting'], environments: ['production'], docsUrl: null,
  },
  {
    key: 'whatsapp', name: 'WhatsApp', monogram: 'WA', category: 'messaging',
    description: 'Mensagens, conversas, templates, status e leads.',
    capabilities: [{ key: 'messages', label: 'Mensagens' }, { key: 'templates', label: 'Templates' }, { key: 'status', label: 'Status' }],
    scopes: ['whatsapp_business_messaging'], environments: ['sandbox', 'production'], docsUrl: null,
  },
  {
    key: 'make', name: 'Make', monogram: 'Mk', category: 'automation',
    description: 'Webhooks externos, automações, gatilhos, ações e logs.',
    capabilities: [{ key: 'webhooks', label: 'Webhooks' }, { key: 'triggers', label: 'Gatilhos' }, { key: 'actions', label: 'Ações' }],
    scopes: [], environments: ['production'], docsUrl: null,
  },
  {
    key: 'n8n', name: 'n8n', monogram: 'N8', category: 'automation',
    description: 'Webhooks externos, automações, gatilhos, ações e logs.',
    capabilities: [{ key: 'webhooks', label: 'Webhooks' }, { key: 'triggers', label: 'Gatilhos' }, { key: 'actions', label: 'Ações' }],
    scopes: [], environments: ['production'], docsUrl: null,
  },
]

export function integrationsByCategory(categories: IntegrationCategory[]): IntegrationProvider[] {
  return INTEGRATION_PROVIDERS.filter(provider => categories.includes(provider.category))
}
