// Camada GENÉRICA da Central de API + Webhooks de ENTRADA (INBOUND-001). Contratos PUROS — nenhum webhook
// real, API externa, secret, banco ou criação de lead. Toda fonte externa futura (Magnetic Funnels, Meta
// Lead Ads, Typeform, Tally, Jotform, WhatsApp, Make, n8n, Zapier, Stripe...) é um PROVIDER que segue este
// padrão. O sistema NÃO se acopla a nenhum provider. Coexiste com o webhook Magnetic atual
// (/api/leads/inbound), que é a implementação provider-específica de hoje — INT-001, nunca reescrever.

// ── Providers, categorias e o que entregam ──
export type InboundProviderKey =
  | 'generic' | 'magnetic' | 'meta_lead_ads' | 'typeform' | 'tally' | 'jotform'
  | 'whatsapp' | 'make' | 'n8n' | 'zapier' | 'stripe'

export type InboundCategory = 'form' | 'ads' | 'messaging' | 'automation' | 'payments' | 'generic'

export type InboundEventKind = 'lead' | 'payment' | 'message' | 'generic'

// ── Part 3: modos de segurança suportados no futuro (nada implementado) ──
export type InboundSecurityMode =
  | 'none' | 'api_key' | 'secret_token' | 'hmac_signature' | 'bearer_token'

// Estado VISUAL de um endpoint/conexão (linguagem profissional; hoje nunca 'active').
export type InboundStatus =
  | 'not_configured' | 'requires_key' | 'awaiting_provider' | 'ready_to_configure' | 'endpoint_disabled' | 'active'

// ── Part 1: contratos conceituais ──

// Definição ESTÁTICA de um provider de entrada (catálogo). Só metadados — nada conecta.
export type InboundProvider = {
  key: InboundProviderKey
  name: string
  monogram: string
  category: InboundCategory
  description: string
  event: InboundEventKind
  auth: InboundSecurityMode
  payloadType: 'json' | 'form' | 'multipart'
  capabilities: { key: string; label: string }[]
  allowsTest: boolean
  allowsReplay: boolean
  status: InboundStatus
}

// Quem enviou um payload (origem externa).
export type InboundSource = {
  provider: InboundProviderKey
  externalId: string | null
  formId: string | null
  campaign: string | null
}

// Conexão RUNTIME de um provider a um workspace (futuro; hoje nunca conectada).
export type InboundConnection = {
  provider: InboundProviderKey
  teamId: string
  clientId?: string
  status: InboundStatus
  securityMode: InboundSecurityMode
  createdAt: string | null
  lastDeliveryAt: string | null
}

// Endpoint de webhook de entrada (futuro — escopado por token/workspace).
export type InboundWebhookEndpoint = {
  provider: InboundProviderKey
  teamId: string
  path: string
  method: 'POST'
  securityMode: InboundSecurityMode
  status: InboundStatus
  createdAt: string | null
}

// Chave de API de entrada (futuro — NUNCA gera secret real aqui; só o prefixo público).
export type InboundApiKey = {
  id: string
  teamId: string
  provider: InboundProviderKey | null
  label: string
  prefix: string
  createdAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
}

// Envelope do payload cru recebido.
export type InboundPayload = {
  provider: InboundProviderKey
  receivedAt: string
  headers: Record<string, string>
  body: unknown
  requestId: string
  contentType: string
}

// ── Part 3: contexto de segurança (tudo modelado; nada implementado) ──
export type InboundSecurityContext = {
  mode: InboundSecurityMode
  apiKeyPrefix: string | null
  bearerPresent: boolean
  requestId: string
  timestamp: string
  payloadHash: string | null            // sha256 do body (futuro)
  providerSignature: string | null      // HMAC do provider (futuro)
  ipAllowlist: string[] | null
  rateLimit: { windowSec: number; max: number } | null
  replayProtection: boolean
}

export type InboundValidationResult =
  | { ok: true; security: InboundSecurityContext }
  | { ok: false; reason: 'unauthorized' | 'bad_signature' | 'rate_limited' | 'replayed' | 'invalid_payload' | 'not_implemented'; message: string }

// ── Part 5: normalização (payload externo → dados internos, sem criar lead) ──
export type InboundLeadPayload = {
  nome: string | null
  telefone: string | null
  email: string | null
  empresa: string | null
  cidade: string | null
  estado: string | null
  pais: string | null
  servico: string | null
  origem: string | null
  campanha: string | null
  formulario: string | null
  mensagem: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  raw_payload: unknown
  received_at: string
  provider: InboundProviderKey
  external_id: string | null
}

// Mapeamento por provider: caminho no payload externo → campo interno.
export type InboundMapping = {
  provider: InboundProviderKey
  fields: Record<keyof InboundLeadPayload, string | null>
}

// ── Part 8: logs futuros ──
export type InboundLogStatus = 'received' | 'validated' | 'rejected' | 'duplicate' | 'created' | 'error' | 'replayed'

export type InboundDeliveryLog = {
  id: string
  provider: InboundProviderKey
  receivedAt: string
  status: InboundLogStatus
  reason: string | null
  leadId: string | null
  requestId: string
  processingMs: number | null
}

export type InboundReplayRequest = {
  deliveryLogId: string
  provider: InboundProviderKey
  requestedBy: string
  requestedAt: string
}

// ── Part 11: contratos de arquitetura (adapters/mapper/validator/normalizer/logger) ──
// Interfaces PURAS. Implementações reais (InboundService/InboundRepository/ProviderAdapter) só quando
// houver autorização + banco. Ninguém aqui grava, chama API externa ou cria lead.
export interface InboundValidator {
  validate(payload: InboundPayload, mode: InboundSecurityMode): Promise<InboundValidationResult>
}
export interface InboundNormalizer {
  normalize(payload: InboundPayload, mapping: InboundMapping): InboundLeadPayload
}
export interface InboundMapper {
  mappingFor(provider: InboundProviderKey): InboundMapping
}
export interface InboundDeliveryLogger {
  log(entry: Omit<InboundDeliveryLog, 'id'>): Promise<void>
}
// Adapter por provider (ProviderAdapter): junta mapping + verificação específica do provider.
export interface InboundAdapter {
  readonly provider: InboundProviderKey
  mapping(): InboundMapping
  verify(payload: InboundPayload): Promise<InboundValidationResult>
}
