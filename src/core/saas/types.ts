// Fundação de PLATAFORMA SaaS (Constituição, Título 10). Somente contratos — nada implementado.
// Prepara Workspace, Billing, Feature Flags, Plugins, Webhooks, Licenciamento e White Label.

// Workspace fica ACIMA da equipe (futuro). Hoje o tenant é a própria equipe (TEAM-001); a migração
// para workspace será aditiva — nunca trocando team_id existente.
export type Workspace = {
  id: string
  name: string
  ownerId: string | null
}

export type BillingPlanTier = 'free' | 'starter' | 'pro' | 'enterprise'
export type BillingPlan = { tier: BillingPlanTier; name: string; priceMonthly: number }
export type Subscription = {
  workspaceId: string
  plan: BillingPlanTier
  status: 'active' | 'past_due' | 'canceled'
}

export type FeatureFlagKey = string
export type FeatureFlag = { key: FeatureFlagKey; enabled: boolean; workspaceId: string | null }

export type WebhookEndpoint = { id: string; workspaceId: string; url: string; events: string[]; active: boolean }

export type PluginManifest = { id: string; name: string; version: string; scopes: string[] }

export type License = { workspaceId: string; seats: number; validUntil: string | null }

export type WhiteLabelConfig = {
  workspaceId: string
  brandName: string | null
  primaryColor: string | null
  logoUrl: string | null
}
