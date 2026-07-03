import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import { getClientWorkspace } from './ClientWorkspaceService'
import { getLeadIdForClient, getMeetingsByLead } from '@/server/repositories/ClientRepository'

// Agenda REAL do cliente (CLIENT-005). Usa as reuniões do LEAD de origem (meetings.lead_id), resolvido via
// deals. Sem Google Calendar/Outlook — só dados internos. Isolamento por equipe via getClientWorkspace.
export type ClientAgendaMeeting = { id: string; note: string | null; metOn: string | null }
export type ClientAgendaVM = {
  counts: { hoje: number; estaSemana: number; proximos30: number; concluidas: number }
  proximas: ClientAgendaMeeting[]   // futuro (met_on >= hoje), ascendente
  concluidas: ClientAgendaMeeting[] // passado (met_on < hoje), descendente
}

const EMPTY: ClientAgendaVM = { counts: { hoje: 0, estaSemana: 0, proximos30: 0, concluidas: 0 }, proximas: [], concluidas: [] }
const spToday = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const addDays = (ymd: string, days: number): string => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10)
}

export async function getClientAgenda(context: RequestContext, clientId: string): Promise<ClientAgendaVM> {
  const client = await getClientWorkspace(clientId) // team-scoped (TEAM-001)
  if (!client) return EMPTY
  const leadId = await getLeadIdForClient(clientId)
  if (!leadId) return EMPTY
  const meetings = await getMeetingsByLead(leadId)

  const today = spToday()
  const in7 = addDays(today, 7)
  const in30 = addDays(today, 30)

  const dated = meetings
    .map(m => ({ id: m.id, note: m.note ?? null, metOn: m.met_on ? String(m.met_on).slice(0, 10) : null }))
    .filter((m): m is ClientAgendaMeeting & { metOn: string } => m.metOn != null)

  const proximas = dated.filter(m => m.metOn >= today).sort((a, b) => a.metOn.localeCompare(b.metOn))
  const concluidas = dated.filter(m => m.metOn < today).sort((a, b) => b.metOn.localeCompare(a.metOn))

  return {
    counts: {
      hoje: dated.filter(m => m.metOn === today).length,
      estaSemana: dated.filter(m => m.metOn > today && m.metOn <= in7).length,
      proximos30: dated.filter(m => m.metOn > today && m.metOn <= in30).length,
      concluidas: concluidas.length,
    },
    proximas,
    concluidas,
  }
}
