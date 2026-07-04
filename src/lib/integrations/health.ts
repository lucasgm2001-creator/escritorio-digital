import type { IntegrationHealthState } from './types'

// SAÚDE das integrações (INT-001). Contrato PURO — nenhuma verificação real é executada. Os 7 estados
// oficiais, seus rótulos/tons e o rollup (pior estado entre as conexões). Sem conexões → 'unknown' (honesto).

export type HealthTone = 'ok' | 'warn' | 'danger' | 'neutral'

export type HealthStateMeta = {
  state: IntegrationHealthState
  label: string
  tone: HealthTone
  description: string
}

export const HEALTH_STATES: HealthStateMeta[] = [
  { state: 'healthy',      label: 'Saudável',              tone: 'ok',      description: 'Conectado e respondendo normalmente.' },
  { state: 'warning',      label: 'Atenção',               tone: 'warn',    description: 'Conectado, mas com sinais de degradação (latência ou erros esporádicos).' },
  { state: 'rate_limit',   label: 'Limite de taxa',        tone: 'warn',    description: 'Rate limit atingido — chamadas temporariamente bloqueadas pelo provider.' },
  { state: 'auth_error',   label: 'Erro de autenticação',  tone: 'danger',  description: 'Credenciais expiradas ou revogadas — requer reconectar.' },
  { state: 'config_error', label: 'Erro de configuração',  tone: 'danger',  description: 'Configuração incompleta ou inválida do provider.' },
  { state: 'offline',      label: 'Offline',               tone: 'danger',  description: 'Sem resposta do provider.' },
  { state: 'unknown',      label: 'Desconhecido',          tone: 'neutral', description: 'Sem verificação ainda — nada conectado nesta central.' },
]

// Classes Tailwind por tom (consistente com o uso atual do DS: amber/red-400, tokens bento).
export const HEALTH_TONE_CLASS: Record<HealthTone, string> = {
  ok:      'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  warn:    'text-amber-400 border-amber-500/30 bg-amber-500/10',
  danger:  'text-red-400 border-red-500/30 bg-red-500/10',
  neutral: 'text-bento-dim border-bento-border bg-bento-surface/40',
}

const BY_STATE = new Map(HEALTH_STATES.map(h => [h.state, h]))

export function healthMeta(state: IntegrationHealthState): HealthStateMeta {
  return BY_STATE.get(state) ?? HEALTH_STATES[HEALTH_STATES.length - 1]
}

// Severidade p/ o rollup (maior = pior).
const SEVERITY: Record<IntegrationHealthState, number> = {
  offline: 5, auth_error: 5, config_error: 4, rate_limit: 3, warning: 2, healthy: 1, unknown: 0,
}

// Pior estado entre um conjunto de conexões. Vazio → 'unknown' (nada a verificar).
export function rollupHealth(states: IntegrationHealthState[]): IntegrationHealthState {
  if (states.length === 0) return 'unknown'
  return states.reduce((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst))
}
