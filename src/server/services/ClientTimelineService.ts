import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { LeadTimelineItem } from '@/lib/commercial/lead-hub-types'
import { categoryForInteractionType } from '@/lib/commercial/lead-categories'
import { getClientWorkspace } from './ClientWorkspaceService'
import { getClientLeadHub } from './ClientContextService'
import { getClientPaymentsByClient, getClientActivities } from '@/server/repositories/ClientRepository'

// Timeline REAL e UNIFICADA do cliente (CLIENT-005). Junta os eventos do CLIENTE (criação, recebimentos,
// atividades) com toda a timeline do LEAD de origem (reuniões, propostas, fases, observações, deals) — via
// getClientLeadHub, que REUSA o LeadHub. Mesmo contrato/visual do Lead Hub (reusa LeadTimeline). Sem
// duplicar eventos (dedupe por id). Isolamento por equipe via getClientWorkspace.
const usd = (value: number): string => `US$ ${Math.round(value).toLocaleString('en-US')}`

export async function getClientTimeline(context: RequestContext, clientId: string): Promise<LeadTimelineItem[]> {
  const client = await getClientWorkspace(clientId) // team-scoped (TEAM-001) + cache
  if (!client) return []

  const [payments, activities, leadHub] = await Promise.all([
    getClientPaymentsByClient(clientId),
    getClientActivities(clientId),
    getClientLeadHub(context, clientId),
  ])

  const items: LeadTimelineItem[] = []

  // Cliente criado
  items.push({
    id: `created-${client.id}`,
    type: 'atividade', category: 'informacao', origin: 'sistema',
    author: client.assigned_name ?? null, at: client.created_at ?? null,
    title: 'Cliente criado', description: `${client.name} entrou como cliente.`,
  })

  // Pagamentos (client_payments) — recebido / anulado
  for (const payment of payments) {
    const week = Number(payment.numero_semana)
    const value = usd(Number(payment.valor_usd ?? 0))
    if (payment.anulado) {
      items.push({
        id: `pay-void-${payment.id}`, type: 'perda', category: 'problema', origin: 'sistema',
        author: null, at: payment.paid_on ?? null,
        title: `Pagamento anulado — Semana ${week}`, description: value,
      })
    } else {
      items.push({
        id: `pay-${payment.id}`, type: 'fechamento', category: 'contrato', origin: 'sistema',
        author: null, at: payment.paid_on ?? null,
        title: `Pagamento recebido — Semana ${week}`, description: value,
      })
    }
  }

  // Atividades do cliente (activities.entity_id = cliente), se existirem
  for (const activity of activities) {
    items.push({
      id: `cact-${activity.id}`, type: 'atividade', category: categoryForInteractionType(activity.type), origin: 'sistema',
      author: activity.user_name ?? null, at: activity.created_at ?? null,
      title: activity.description || activity.type, description: null,
    })
  }

  // Timeline do LEAD de origem (reuniões, propostas, fases, observações, deals) — reuso do LeadHub.
  if (leadHub) items.push(...leadHub.timeline)

  // Dedupe por id + ordena do mais novo ao mais antigo (LeadTimeline agrupa preservando a ordem).
  const seen = new Set<string>()
  const unique = items.filter(item => (seen.has(item.id) ? false : (seen.add(item.id), true)))
  unique.sort((a, b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0))
  return unique
}
