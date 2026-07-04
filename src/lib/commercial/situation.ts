// Modelo de SITUAÇÃO do lead (RADAR-COMERCIAL-001). Tipos + labels + derivação. PURO (client e server) —
// nenhuma persistência aqui. Os enums são validados NA APLICAÇÃO (a migration 045 não usa CHECK rígido).

export type LastAction =
  | 'respondeu_interessado' | 'pediu_retorno' | 'marcou_reuniao' | 'recebeu_proposta'
  | 'nao_respondeu' | 'desistiu' | 'fechou' | 'sem_mudanca'
export type NextAction =
  | 'nenhuma' | 'ligar' | 'mensagem' | 'cobrar_retorno' | 'enviar_proposta' | 'marcar_reuniao' | 'aguardar'
export type Temperature = 'frio' | 'morno' | 'quente' | 'muito_quente'
export type FollowupState =
  | 'precisa_agir' | 'aguardando' | 'agendado' | 'sem_atualizacao' | 'desistiu' | 'fechado' | 'perdido'
export type LeadResponse = 'sim' | 'nao' | 'nao_falei'
export type WhenChoice = 'hoje' | 'amanha' | 'esta_semana' | 'data'

export const LAST_ACTION_LABEL: Record<LastAction, string> = {
  respondeu_interessado: 'Respondeu interessado', pediu_retorno: 'Pediu retorno', marcou_reuniao: 'Marcou reunião',
  recebeu_proposta: 'Recebeu proposta', nao_respondeu: 'Não respondeu', desistiu: 'Desistiu',
  fechou: 'Fechou', sem_mudanca: 'Sem mudança',
}
export const NEXT_ACTION_LABEL: Record<NextAction, string> = {
  nenhuma: 'Nenhuma', ligar: 'Ligar', mensagem: 'Mandar mensagem', cobrar_retorno: 'Cobrar retorno',
  enviar_proposta: 'Enviar proposta', marcar_reuniao: 'Marcar reunião', aguardar: 'Aguardar',
}
export const TEMPERATURE_LABEL: Record<Temperature, string> = {
  frio: 'Frio', morno: 'Morno', quente: 'Quente', muito_quente: 'Muito quente',
}
export const FOLLOWUP_STATE_LABEL: Record<FollowupState, string> = {
  precisa_agir: 'Precisa agir hoje', aguardando: 'Aguardando resposta', agendado: 'Agendado',
  sem_atualizacao: 'Sem atualização', desistiu: 'Desistiu', fechado: 'Fechado', perdido: 'Perdido',
}

export const LAST_ACTIONS = Object.keys(LAST_ACTION_LABEL) as LastAction[]
export const NEXT_ACTIONS = Object.keys(NEXT_ACTION_LABEL) as NextAction[]
export const TEMPERATURES = Object.keys(TEMPERATURE_LABEL) as Temperature[]
export const FOLLOWUP_STATES = Object.keys(FOLLOWUP_STATE_LABEL) as FollowupState[]

export const isLastAction = (x: unknown): x is LastAction => typeof x === 'string' && (LAST_ACTIONS as string[]).includes(x)
export const isNextAction = (x: unknown): x is NextAction => typeof x === 'string' && (NEXT_ACTIONS as string[]).includes(x)
export const isTemperature = (x: unknown): x is Temperature => typeof x === 'string' && (TEMPERATURES as string[]).includes(x)

// Deriva o estado de acompanhamento a partir do resultado + próxima ação + quando (no servidor).
export function deriveFollowupState(lastAction: LastAction, nextAction: NextAction, when: WhenChoice | null): FollowupState {
  if (lastAction === 'desistiu') return 'desistiu'
  if (lastAction === 'fechou') return 'fechado'
  if (nextAction === 'nenhuma') return lastAction === 'nao_respondeu' ? 'sem_atualizacao' : 'aguardando'
  if (nextAction === 'aguardar') return 'aguardando'
  if (when === 'hoje') return 'precisa_agir'
  return 'agendado'
}

// Temperatura aproximada a partir do score — fallback do Radar quando não há temperatura explícita.
export function temperatureFromScore(score: number | null | undefined): Temperature | null {
  if (score == null) return null
  if (score >= 800) return 'muito_quente'
  if (score >= 550) return 'quente'
  if (score >= 300) return 'morno'
  return 'frio'
}

// Resolve a data (YYYY-MM-DD) da próxima ação a partir do "quando". 'esta_semana' = +3 dias (alvo suave).
export function nextContactFromWhen(when: WhenChoice, explicitDate: string | null, today: Date): string | null {
  if (when === 'data') return explicitDate
  const d = new Date(today)
  if (when === 'amanha') d.setDate(d.getDate() + 1)
  else if (when === 'esta_semana') d.setDate(d.getDate() + 3)
  return d.toISOString().slice(0, 10)
}
