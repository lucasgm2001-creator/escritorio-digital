import type { IntegrationProviderKey } from './types'

// Arquitetura ÚNICA de OAuth (INT-001). Contratos PUROS — nenhum fluxo real, nenhum token trocado ou gravado
// aqui. Generaliza o padrão JÁ existente e REAL do Google (lib/google/oauth.ts: state assinado por HMAC,
// consent URL, troca de code, refresh e token store em service-role). Todo provider OAuth (Google Ads/GA4/
// GTM/Calendar/Gmail/Meta/Outlook/LinkedIn/TikTok) deve usar ESTA infraestrutura — nada duplicado por provider.

// Config estática por provider OAuth (endpoints + escopos). client_id/secret vêm de env (server-only, nunca aqui).
export type OAuthProviderConfig = {
  provider: IntegrationProviderKey
  authorizeUrl: string
  tokenUrl: string
  scopes: string[]
  usesPKCE: boolean
  usesRefreshToken: boolean
  clientIdEnv: string                          // NOME da env (nunca o valor)
  clientSecretEnv: string
}

// State CSRF assinado (o Google já faz exatamente isto). Recuperado no callback sem confiar no browser.
export type OAuthState = {
  userId: string
  teamId: string
  provider: IntegrationProviderKey
  nonce: string
  issuedAt: number
}

// Conjunto de tokens devolvido pela troca de code / refresh.
export type OAuthTokenSet = {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null                     // ISO
  scope: string | null
  externalAccountId: string | null             // conta conectada (ex.: e-mail)
}

// Persistência de tokens — escopada por (team, provider, user). SEMPRE service-role; nunca vai ao browser.
// A impl real do Google (tabela google_oauth_tokens) é a PRIMEIRA a satisfazer este contrato.
export type OAuthTokenScope = { teamId: string; provider: IntegrationProviderKey; userId: string }

export interface OAuthTokenStore {
  get(scope: OAuthTokenScope): Promise<OAuthTokenSet | null>
  save(scope: OAuthTokenScope, tokens: OAuthTokenSet): Promise<void>
  delete(scope: OAuthTokenScope): Promise<void>
}

// O fluxo unificado que todo provider OAuth compartilha (sign/verify state, consent, exchange, refresh).
export interface OAuthFlow {
  buildConsentUrl(config: OAuthProviderConfig, state: OAuthState): string
  signState(state: OAuthState): string
  verifyState(raw: string | null): OAuthState | null
  exchangeCode(config: OAuthProviderConfig, code: string): Promise<OAuthTokenSet | null>
  refresh(config: OAuthProviderConfig, refreshToken: string): Promise<OAuthTokenSet | null>
}
