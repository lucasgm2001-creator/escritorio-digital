import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { LeadTimelineItem } from '@/lib/commercial/lead-hub-types'
import { categoryForInteractionType } from '@/lib/commercial/lead-categories'
import { getClientWorkspace } from './ClientWorkspaceService'
import { getClientPaymentsByClient, getClientActivities } from '@/server/repositories/ClientRepository'

// Timeline REAL do cliente (CLIENT-004). Unifica os dados reais existentes num LeadTimelineItem[] — o
// MESMO contrato/visual do Lead Hub (reusa LeadTimeline). Isolamento por equipe via getClientWorkspace.
// Fontes hoje: clients.created_at, client_payments (recebido/anulado), activities (entity_id = cliente).
// Reuniões/observações/eventos de tráfego entram quando tiverem fonte por cliente (transparente).
const usd = (value: number): string => `US$ ${Math.round(value).toLocaleString('en-US')}`

export async function getClientTimeline(context: RequestContext, clientId: string): Promise<LeadTimelineItem[]> {
  const client = await getClientWorkspace(clientId) // team-scoped (TEAM-001) + cache
  if (!client) return []

  const [payments, activities] = await Promise.all([
    getClientPaymentsByClient(clientId),
    getClientActivities(clientId),
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

  // Atividades (activities.entity_id = cliente), se existirem
  for (const activity of activities) {
    items.push({
      id: `act-${activity.id}`, type: 'atividade', category: categoryForInteractionType(activity.type), origin: 'sistema',
      author: activity.user_name ?? null, at: activity.created_at ?? null,
      title: activity.description || activity.type, description: null,
    })
  }

  // Do mais novo ao mais antigo (LeadTimeline agrupa preservando a ordem).
  items.sort((a, b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0))
  return items
}
