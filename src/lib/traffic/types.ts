// Contratos do domínio TRÁFEGO (TRAFFIC-001). Tipos PUROS — nenhuma implementação, integração, API ou
// banco. Só organização, para o futuro plugar sem refatorar (Event Bus / Reporting / AI / Automation).

// Escopo multi-tenant (TEAM-001) + filtro OPCIONAL por cliente — a aba "Tráfego" no perfil do cliente
// (PARTE 6) reusa exatamente o mesmo módulo, só passando clientId. Nada divergente.
export type TrafficScope = { teamId: string; clientId?: string }

export type TrafficProvider =
  | 'meta_ads' | 'google_ads' | 'ga4' | 'search_console' | 'tiktok_ads' | 'linkedin_ads'

// KPIs executivos (placeholder de contrato — sem cálculo nesta fase).
export type TrafficMetrics = {
  investimento: number
  receita: number
  roas: number
  cpa: number
  ctr: number
  cpm: number
  cpc: number
  conversoes: number
  leads: number
}

export type TrafficAccount = { id: string; teamId: string; provider: TrafficProvider; name: string; connected: boolean }
export type TrafficCampaign = { id: string; accountId: string; name: string; status: 'active' | 'paused' | 'ended' }
export type TrafficCreative = { id: string; campaignId: string; name: string; kind: 'image' | 'video' | 'carousel' | 'text' }
