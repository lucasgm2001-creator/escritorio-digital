import type { Lead } from './types'
import { NEXT_ACTION_LABEL, type NextAction, isNextAction } from '@/lib/commercial/situation'

// Funil estilo Pipedrive: a cor é ALARME, não enfeite. Cada card carrega no
// máximo UM sinal, com prioridade quente > esfriando > atenção.

export type LeadSignal = 'hot' | 'cold' | 'warm' | 'none'

// Score 0–1000: a faixa "Quente" do sistema começa em >650 (ver score.ts).
const HOT_SCORE = 650
const DAY_MS = 86_400_000

/** Dias parado na etapa: desde a última movimentação/contato (fallback: criação). */
export function daysStopped(lead: Lead): number {
  const ref = lead.last_contact_at || lead.created_at
  if (!ref) return 0
  const diff = Date.now() - new Date(ref).getTime()
  if (Number.isNaN(diff)) return 0
  return Math.max(0, Math.floor(diff / DAY_MS))
}

/** Dias na FASE atual (deal rotting do funil novo): desde stage_changed_at (fallback: criação). */
export function daysInStage(lead: Lead): number {
  const ref = lead.stage_changed_at || lead.created_at
  if (!ref) return 0
  const diff = Date.now() - new Date(ref).getTime()
  if (Number.isNaN(diff)) return 0
  return Math.max(0, Math.floor(diff / DAY_MS))
}

export type Heat = 'hot' | 'warm' | 'cold'

/** Limite global padrão de "esfriando" (dias). Usado quando a fase não tem dias_esfriamento. */
export const DEFAULT_COLD_DAYS = 5

/**
 * Temperatura do funil por dias parado na fase. 0–1 = quente; a faixa "atenção" (âmbar) vai até o
 * limite; a partir de `coldDays` = esfriando (vermelho). `coldDays` vem do dias_esfriamento da fase;
 * se null/ausente, cai no padrão global (5) → comportamento idêntico ao de hoje (2–4 atenção, 5+ frio).
 */
export function heatLevel(lead: Lead, coldDays: number | null = DEFAULT_COLD_DAYS): Heat {
  const limit = coldDays && coldDays > 1 ? coldDays : DEFAULT_COLD_DAYS
  const d = daysInStage(lead)
  if (d <= 1) return 'hot'
  if (d >= limit) return 'cold'
  return 'warm'
}

/** Sinal do card. Etapas terminais (ganho/perda) nunca rotulam rotting/quente. */
export function getLeadSignal(lead: Lead): LeadSignal {
  if (lead.status === 'fechado' || lead.status === 'perdido') return 'none'

  const isHot = lead.score >= HOT_SCORE || lead.prioridade === 'alta' || lead.prioridade === 'urgente'
  if (isHot) return 'hot'

  const days = daysStopped(lead)
  if (days >= 5) return 'cold'   // esfriando — risco de perder
  if (days >= 3) return 'warm'   // atenção — parado
  return 'none'
}

/** Próxima ação derivada de next_contact (rótulo relativo curto). null se não houver. */
export function nextActionLabel(lead: Lead): string | null {
  if (!lead.next_contact) return null
  const d = new Date(lead.next_contact)
  if (Number.isNaN(d.getTime())) return null

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(d); target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / DAY_MS)

  if (diff < 0)  return 'atrasado'
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff < 7)  return target.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export type LeadSmartBadgeTone = 'danger' | 'warning' | 'hot' | 'success' | 'info' | 'muted'
export type LeadSmartBadge = {
  key: string
  label: string
  tone: LeadSmartBadgeTone
  title: string
}

const ORIGIN_LABEL: Record<NonNullable<Lead['origem']>, string> = {
  instagram: 'Instagram',
  google: 'Google',
  indicacao: 'Indicação',
  tiktok: 'TikTok',
  site: 'Site',
  outro: 'Outro',
  magnetic: 'Magnetic',
  cliente_existente: 'Cliente',
}

const TEMP_LABEL: Record<string, string> = {
  muito_quente: 'Muito quente',
  quente: 'Quente',
  morno: 'Morno',
  frio: 'Frio',
}

const NEXT_COMPACT: Partial<Record<NextAction, string>> = {
  ligar: 'Ligar',
  mensagem: 'Mensagem',
  cobrar_retorno: 'Cobrar',
  enviar_proposta: 'Proposta',
  marcar_reuniao: 'Reunião',
  aguardar: 'Aguardar',
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim()
}

function temperatureBadge(lead: Lead): LeadSmartBadge | null {
  if (lead.status === 'fechado' || lead.status === 'perdido') return null
  const explicit = lead.temperature && TEMP_LABEL[lead.temperature] ? TEMP_LABEL[lead.temperature] : null
  if (explicit) {
    return {
      key: 'temperature',
      label: explicit,
      tone: lead.temperature === 'frio' ? 'muted' : lead.temperature === 'morno' ? 'warning' : 'hot',
      title: `Temperatura: ${explicit}`,
    }
  }

  const signal = getLeadSignal(lead)
  if (signal === 'hot') return { key: 'temperature', label: 'Quente', tone: 'hot', title: 'Lead quente por score/prioridade' }
  if (signal === 'warm') return { key: 'stopped', label: `${daysStopped(lead)}d parado`, tone: 'warning', title: `Sem avanço há ${daysStopped(lead)} dias` }
  if (signal === 'cold') return { key: 'stopped', label: `${daysStopped(lead)}d parado`, tone: 'danger', title: `Esfriando: sem avanço há ${daysStopped(lead)} dias` }
  return null
}

function nextActionBadge(lead: Lead): LeadSmartBadge | null {
  const relative = nextActionLabel(lead)
  if (relative === 'atrasado') return { key: 'due', label: 'Atrasado', tone: 'danger', title: 'Próxima ação atrasada' }
  if (relative === 'hoje') return { key: 'due', label: 'Hoje', tone: 'success', title: 'Próxima ação para hoje' }

  if (lead.next_action && isNextAction(lead.next_action) && lead.next_action !== 'nenhuma') {
    const label = NEXT_COMPACT[lead.next_action] ?? NEXT_ACTION_LABEL[lead.next_action]
    return { key: 'next', label, tone: 'info', title: `Próxima ação: ${NEXT_ACTION_LABEL[lead.next_action]}` }
  }

  if (relative) return { key: 'next-date', label: relative, tone: 'muted', title: `Próximo contato: ${relative}` }
  if (lead.status === 'reuniao') return { key: 'stage-action', label: 'Reunião', tone: 'info', title: 'Reunião marcada' }
  if (lead.status === 'proposta') return { key: 'stage-action', label: 'Proposta', tone: 'info', title: 'Proposta enviada/em análise' }
  return null
}

function ownerBadge(lead: Lead): LeadSmartBadge {
  const owner = lead.assigned_name?.trim()
  return owner
    ? { key: 'owner', label: firstName(owner), tone: 'muted', title: `Responsável: ${owner}` }
    : { key: 'owner', label: 'Sem resp.', tone: 'warning', title: 'Lead sem responsável definido' }
}

function sourceBadge(lead: Lead): LeadSmartBadge | null {
  if (!lead.origem) return null
  return { key: 'source', label: ORIGIN_LABEL[lead.origem] ?? lead.origem, tone: 'muted', title: `Origem: ${ORIGIN_LABEL[lead.origem] ?? lead.origem}` }
}

export function leadSubtitle(lead: Lead): string {
  return lead.company || lead.nicho || (lead.origem ? ORIGIN_LABEL[lead.origem] : '') || ''
}

export function smartLeadBadges(lead: Lead, max = 3): LeadSmartBadge[] {
  const badges = [
    nextActionBadge(lead),
    temperatureBadge(lead),
    ownerBadge(lead),
    sourceBadge(lead),
  ].filter(Boolean) as LeadSmartBadge[]

  const seen = new Set<string>()
  return badges.filter(badge => {
    if (seen.has(badge.key)) return false
    seen.add(badge.key)
    return true
  }).slice(0, max)
}
