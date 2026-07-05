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

// ─── Derivação HONESTA da situação para o Radar (PRODUCT-SPRINT-003, PARTE EXTRA) ────────────────
// O Radar é uma FILA OPERACIONAL: quando não há situação/ação MANUAL, deriva uma leitura fiel a partir dos dados
// reais (fase do funil, última interação, next_contact, reunião/proposta/venda/desistência) — nunca inventa,
// nunca esconde. Puro (client+server). Recebe uma visão mínima da fase (resolvida de funnel_stages pela UI) para
// não acoplar aqui a tabela de fases.
export type LeadSituationInput = {
  status?: string | null
  score?: number | null
  current_situation?: string | null
  last_action?: string | null
  next_action?: string | null
  next_contact?: string | null
  last_contact_at?: string | null
  temperature?: string | null
  followup_state?: string | null
  received_at?: string | null
}
export type StageFacts = { name: string; isWon: boolean; isLost: boolean; isMeeting: boolean; isProposal: boolean }
export type LeadSituationView = {
  state: FollowupState
  temp: Temperature | null
  situation: string          // "por que está nessa situação" (manual OU derivada)
  situationDerived: boolean   // true = não veio de campo manual
  nextText: string           // o que fazer (nunca vazio quando há ação possível)
  nextWhen: string | null    // quando (YYYY-MM-DD), se houver
  urgency: number            // ordenação da fila: MENOR = mais no topo (atrasado primeiro)
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
const tempRank = (t: Temperature | null): number => (t === 'muito_quente' ? 3 : t === 'quente' ? 2 : t === 'morno' ? 1 : 0)

export function deriveLeadSituation(l: LeadSituationInput, stage: StageFacts, today: string): LeadSituationView {
  const temp = (isTemperature(l.temperature) ? l.temperature : null) ?? temperatureFromScore(l.score)
  const overdue = !!l.next_contact && l.next_contact.slice(0, 10) <= today
  const scheduled = !!l.next_contact && l.next_contact.slice(0, 10) > today

  // ── ESTADO (o bucket da fila) — manual se existir, senão derivado dos dados reais ──
  let state: FollowupState
  if (l.followup_state && (FOLLOWUP_STATES as string[]).includes(l.followup_state)) state = l.followup_state as FollowupState
  else if (stage.isWon) state = 'fechado'
  else if (stage.isLost) state = l.last_action === 'desistiu' ? 'desistiu' : 'perdido'
  else if (overdue) state = 'precisa_agir'
  else if (scheduled) state = 'agendado'
  else if (l.last_contact_at) state = 'aguardando'
  else state = 'sem_atualizacao'

  // ── SITUAÇÃO (por quê) — manual OU derivada honesta ──
  let situation: string, situationDerived = false
  if (l.current_situation && l.current_situation.trim()) situation = l.current_situation.trim()
  else {
    situationDerived = true
    if (stage.isWon) situation = 'Venda fechada — cliente ativo.'
    else if (stage.isLost) situation = l.last_action === 'desistiu' ? 'Lead desistiu.' : 'Lead perdido.'
    else {
      const bits = [stage.name]
      const rel = relativeDayLabel(l.last_contact_at, today)
      if (rel) bits.push(`último contato ${rel}`)
      else { const chegou = relativeDayLabel(l.received_at, today); bits.push(chegou ? `sem contato (chegou ${chegou})` : 'ainda sem contato') }
      situation = bits.join(' · ')
    }
  }

  // ── PRÓXIMA AÇÃO (o quê) + QUANDO — manual OU derivada ──
  let nextText: string, nextWhen: string | null = l.next_contact ? l.next_contact.slice(0, 10) : null
  if (l.next_action && l.next_action !== 'nenhuma' && (NEXT_ACTIONS as string[]).includes(l.next_action)) nextText = NEXT_ACTION_LABEL[l.next_action as NextAction]
  else if (stage.isWon || stage.isLost) { nextText = '—'; nextWhen = null }
  else if (overdue) nextText = 'Follow-up atrasado'
  else if (scheduled) nextText = 'Follow-up agendado'
  else if (stage.isMeeting) nextText = 'Realizar / confirmar reunião'
  else if (stage.isProposal) nextText = 'Cobrar retorno da proposta'
  else if (l.last_contact_at) nextText = 'Retomar contato'
  else nextText = 'Fazer primeiro contato'

  // ── URGÊNCIA (fila): MENOR sobe. Atrasado (dias negativos) no topo; futuro desce; fechados/perdidos no fim.
  //    Quente desempata dentro do mesmo nível. "Sem atualização" fica atrás de quem tem data, à frente do futuro distante.
  let urgency: number
  if (stage.isWon || stage.isLost) urgency = 100_000
  else if (l.next_contact) urgency = toDays(l.next_contact) - toDays(today)   // <0 atrasado, 0 hoje, >0 futuro
  else if (state === 'sem_atualizacao') urgency = 30
  else urgency = 20
  return { state, temp, situation, situationDerived, nextText, nextWhen, urgency: urgency - tempRank(temp) * 0.1 }
}
