// Modelo de SITUAÇÃO do lead (RADAR-COMERCIAL-001). Tipos + labels + derivação. PURO (client e server) —
// nenhuma persistência aqui. Os enums são validados NA APLICAÇÃO (a migration 045 não usa CHECK rígido).

export type LastAction =
  | 'respondeu_interessado' | 'pediu_retorno' | 'marcou_reuniao' | 'recebeu_proposta'
  | 'nao_respondeu' | 'desistiu' | 'fechou' | 'sem_mudanca'
  | 'ligacao_nao_atendeu' | 'ligacao_ocupado' | 'ligacao_caixa_postal' | 'ligacao_conversou'
  | 'ligacao_marcou_reuniao' | 'ligacao_pediu_proposta' | 'ligacao_ja_cliente' | 'ligacao_numero_invalido'
  | 'pediu_proposta' | 'ja_e_cliente'
  | 'whatsapp_nao_visualizou' | 'whatsapp_visualizou' | 'whatsapp_respondeu'
  | 'whatsapp_pediu_proposta' | 'whatsapp_marcou_reuniao' | 'whatsapp_parou_responder'
  | 'cliente_pediu_proposta' | 'cliente_quer_reuniao' | 'cliente_tirou_duvidas'
  | 'cliente_quer_fechar' | 'cliente_quer_negociar' | 'cliente_pediu_retorno'
export type NextAction =
  | 'nenhuma' | 'ligar' | 'mensagem' | 'cobrar_retorno' | 'enviar_proposta' | 'marcar_reuniao' | 'aguardar'
  | 'encerrar_oportunidade'
export type Temperature =
  | 'frio' | 'morno' | 'quente' | 'muito_quente'
  | 'muito_interessado' | 'interessado' | 'em_duvida' | 'pensando'
  | 'esfriando' | 'pouco_interessado' | 'nao_interessado' | 'nao_avaliado'
export type FollowupState =
  | 'precisa_agir' | 'aguardando' | 'agendado' | 'sem_atualizacao' | 'desistiu' | 'fechado' | 'perdido'
export type LeadResponse = 'sim' | 'nao' | 'nao_falei'
export type WhenChoice = 'hoje' | 'amanha' | 'esta_semana' | 'em_3_dias' | 'em_7_dias' | 'data'

export const LAST_ACTION_LABEL: Record<LastAction, string> = {
  respondeu_interessado: 'Respondeu interessado', pediu_retorno: 'Pediu retorno', marcou_reuniao: 'Marcou reunião',
  recebeu_proposta: 'Recebeu proposta', nao_respondeu: 'Não respondeu', desistiu: 'Desistiu',
  fechou: 'Fechou', sem_mudanca: 'Sem mudança',
  ligacao_nao_atendeu: 'Ligação: não atendeu', ligacao_ocupado: 'Ligação: ocupado',
  ligacao_caixa_postal: 'Ligação: caixa postal', ligacao_conversou: 'Ligação: conversou',
  ligacao_marcou_reuniao: 'Ligação: marcou reunião', ligacao_pediu_proposta: 'Ligação: pediu proposta',
  ligacao_ja_cliente: 'Ligação: já é cliente', ligacao_numero_invalido: 'Ligação: número inválido',
  pediu_proposta: 'Pediu proposta', ja_e_cliente: 'Já é cliente',
  whatsapp_nao_visualizou: 'Não visualizou', whatsapp_visualizou: 'Visualizou', whatsapp_respondeu: 'Respondeu',
  whatsapp_pediu_proposta: 'WhatsApp: pediu proposta', whatsapp_marcou_reuniao: 'WhatsApp: marcou reunião',
  whatsapp_parou_responder: 'Parou de responder', cliente_pediu_proposta: 'Cliente pediu proposta',
  cliente_quer_reuniao: 'Cliente quer reunião', cliente_tirou_duvidas: 'Cliente tirou dúvidas',
  cliente_quer_fechar: 'Cliente quer fechar', cliente_quer_negociar: 'Cliente quer negociar',
  cliente_pediu_retorno: 'Cliente pediu retorno',
}
export const NEXT_ACTION_LABEL: Record<NextAction, string> = {
  nenhuma: 'Nenhuma', ligar: 'Ligar novamente', mensagem: 'Enviar WhatsApp', cobrar_retorno: 'Cobrar retorno',
  enviar_proposta: 'Enviar proposta', marcar_reuniao: 'Agendar reunião', aguardar: 'Aguardar cliente',
  encerrar_oportunidade: 'Encerrar oportunidade',
}
export const TEMPERATURE_LABEL: Record<Temperature, string> = {
  frio: 'Frio', morno: 'Morno', quente: 'Quente', muito_quente: 'Muito quente',
  muito_interessado: 'Muito interessado', interessado: 'Interessado', em_duvida: 'Em dúvida',
  pensando: 'Pensando', esfriando: 'Esfriando', pouco_interessado: 'Pouco interessado',
  nao_interessado: 'Não interessado', nao_avaliado: 'Não foi possível avaliar',
}
const LAST_ACTIONS = Object.keys(LAST_ACTION_LABEL) as LastAction[]
const NEXT_ACTIONS = Object.keys(NEXT_ACTION_LABEL) as NextAction[]
const TEMPERATURES = Object.keys(TEMPERATURE_LABEL) as Temperature[]

export const isLastAction = (x: unknown): x is LastAction => typeof x === 'string' && (LAST_ACTIONS as string[]).includes(x)
export const isNextAction = (x: unknown): x is NextAction => typeof x === 'string' && (NEXT_ACTIONS as string[]).includes(x)
export const isTemperature = (x: unknown): x is Temperature => typeof x === 'string' && (TEMPERATURES as string[]).includes(x)

// Deriva o estado de acompanhamento a partir do resultado + próxima ação + quando (no servidor).
export function deriveFollowupState(lastAction: LastAction, nextAction: NextAction, when: WhenChoice | null): FollowupState {
  if (lastAction === 'desistiu') return 'desistiu'
  if (lastAction === 'fechou' || lastAction === 'ja_e_cliente' || lastAction === 'ligacao_ja_cliente') return 'fechado'
  if (nextAction === 'nenhuma') return lastAction === 'nao_respondeu' || lastAction === 'ligacao_nao_atendeu' ? 'sem_atualizacao' : 'aguardando'
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
  else if (when === 'esta_semana' || when === 'em_3_dias') d.setDate(d.getDate() + 3)
  else if (when === 'em_7_dias') d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

const dayMs = 86_400_000
const toDays = (ymd: string): number => { const [y, m, d] = ymd.slice(0, 10).split('-').map(Number); return Date.UTC(y, (m ?? 1) - 1, d ?? 1) / dayMs }
// Rótulo relativo honesto: "hoje" / "ontem" / "há N dias" / "em N dias".
export function relativeDayLabel(iso: string | null | undefined, today: string): string | null {
  if (!iso) return null
  const diff = toDays(String(iso)) - toDays(today)
  if (diff === 0) return 'hoje'
  if (diff === -1) return 'ontem'
  if (diff === 1) return 'amanhã'
  return diff < 0 ? `há ${-diff} dias` : `em ${diff} dias`
}
export function temperatureRank(t: Temperature | null): number {
  if (t === 'muito_quente' || t === 'muito_interessado') return 3
  if (t === 'quente' || t === 'interessado') return 2
  if (t === 'morno' || t === 'em_duvida' || t === 'pensando') return 1
  return 0
}

export function temperatureTone(t: Temperature | string | null | undefined): 'hot' | 'warm' | 'cold' | 'unknown' {
  if (t === 'muito_quente' || t === 'muito_interessado' || t === 'quente' || t === 'interessado') return 'hot'
  if (t === 'morno' || t === 'em_duvida' || t === 'pensando') return 'warm'
  if (t === 'frio' || t === 'esfriando' || t === 'pouco_interessado' || t === 'nao_interessado') return 'cold'
  return 'unknown'
}
