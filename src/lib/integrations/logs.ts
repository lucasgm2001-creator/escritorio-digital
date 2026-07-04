import type { IntegrationProviderKey } from './types'

// Modelo de LOG de integração (INT-001). Contrato PURO — nenhuma persistência, nenhum log real gravado.
// Quando um provider for ativado, cada chamada/entrega vira uma destas entradas. A Central mostra "nenhum
// log ainda" até lá (estado honesto). Complementa /admin/logs (visão técnica geral) — não a reescreve.

export type IntegrationLogResult = 'success' | 'error' | 'skipped' | 'retried'
export type IntegrationLogDirection = 'inbound' | 'outbound'

export type IntegrationLogEntry = {
  id: string
  at: string                                   // ISO — "Hora"
  provider: IntegrationProviderKey             // "Provider"
  direction: IntegrationLogDirection
  action: string                               // "Ação" (ex.: 'sync.campaigns', 'webhook.received')
  result: IntegrationLogResult                 // "Resultado"
  durationMs: number | null                    // "Tempo"
  error: string | null                         // "Erro"
  payloadSummary: string | null                // "Payload resumido" — NUNCA o payload cru/secreto
}

export const LOG_RESULT_LABELS: Record<IntegrationLogResult, string> = {
  success: 'Sucesso', error: 'Erro', skipped: 'Ignorado', retried: 'Repetido',
}

// Colunas oficiais do registro — a UI monta o cabeçalho da tabela a partir daqui.
export const LOG_COLUMNS = ['Hora', 'Provider', 'Ação', 'Resultado', 'Tempo', 'Erro', 'Payload'] as const
