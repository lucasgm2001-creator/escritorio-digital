// Fundação de EVENTOS DE DOMÍNIO (Constituição, Título 5). Isto NÃO é um Event Bus — são apenas os
// CONTRATOS. Todo acontecimento importante vira um DomainEvent: imutável, escopado por workspace/equipe,
// entregue via Outbox. Consumidores futuros: CRM, Financeiro, Compensation, Dashboard, IA, Automações,
// Notificações, Relatórios. Nada é publicado ou entregue nesta fase.

export type DomainEventType =
  | 'lead.created'
  | 'lead.stage_changed'
  | 'sale.created'
  | 'payment.received'
  | 'upgrade.applied'
  | 'renewal.reached'
  | 'goal.reached'
  | 'member.joined'
  | 'client.churned'
  | 'meeting.done'
  | 'task.completed'

// Escopo multi-tenant (TEAM-001). workspaceId é reservado para o futuro (SaaS); hoje o tenant é a equipe.
export type EventScope = {
  workspaceId: string | null
  teamId: string
}

export type DomainEvent<TPayload = Record<string, unknown>> = {
  id: string
  type: DomainEventType
  scope: EventScope
  payload: TPayload
  occurredAt: string        // ISO — nunca recalculado (histórico imutável)
  actorUserId: string | null
}

// Publisher: emite eventos. Futuro: grava no Outbox na MESMA transação da escrita de negócio.
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>
}

// Handler: reage a um tipo de evento. DEVE ser idempotente.
export interface EventHandler<TPayload = Record<string, unknown>> {
  readonly type: DomainEventType
  handle(event: DomainEvent<TPayload>): Promise<void>
}

// Outbox: garante entrega (evento persistido junto da escrita; um worker despacha depois).
export type OutboxStatus = 'pending' | 'dispatched' | 'failed'

export type OutboxRecord = {
  id: string
  event: DomainEvent
  status: OutboxStatus
  attempts: number
  createdAt: string
}
