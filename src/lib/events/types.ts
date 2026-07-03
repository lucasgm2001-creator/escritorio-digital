// Fundação do EVENT BUS (EVENT-001). Contratos PUROS, provider-agnostic — NENHUM publisher/subscriber real,
// fila, worker, persistência, integração ou alteração de banco. Mesmo padrão de lib/integrations, lib/billing
// e lib/inbound. Quando o motor existir, todos os módulos (Timeline/Dashboard/IA/Billing/Inbound/Integrações/
// Notificações) conversarão por estes eventos SEM se acoplarem entre si.

// ── Categorias, prioridade, tipo ──
export type EventCategory =
  | 'lead' | 'task' | 'meeting' | 'client' | 'payment'
  | 'integration' | 'webhook' | 'report' | 'notification' | 'ai' | 'system'
  | 'workspace' | 'people'

export type EventPriority = 'low' | 'normal' | 'high' | 'critical'

// Nome canônico "categoria.acao" (ex.: 'lead.created'). O EVENT_CATALOG lista os tipos oficiais.
export type EventType = string

// ── Origem / destino ──
export type EventSource = { module: string; provider?: string | null }
export type EventTarget = { module: string; async?: boolean }

// ── Contexto multi-tenant (TEAM-001) ──
export type EventContext = {
  teamId: string
  userId: string | null        // quem originou (null = sistema/automação)
  requestId: string | null
}

// ── Metadados do evento ──
export type EventMetadata = {
  priority: EventPriority
  source: EventSource
  targets: EventTarget[]        // módulos interessados (documental; sem entrega real)
  emittedAt: string
  version: number               // versão do schema do payload (evolução segura)
  payloadHash: string | null    // sha256 do payload (futuro)
}

// Payload genérico — cada tipo define seu formato; aqui só o envelope.
export type EventPayload = Record<string, unknown>

// ── DomainEvent: o evento em si ──
export type DomainEvent<P extends EventPayload = EventPayload> = {
  id: string
  type: EventType
  category: EventCategory
  context: EventContext
  metadata: EventMetadata
  payload: P
  entity: { kind: string; id: string } | null   // entidade principal (lead/task/client/payment...)
}

// ── Contratos de arquitetura (Part 2) — interfaces PURAS, sem implementação ──
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>
}
export interface EventHandler<P extends EventPayload = EventPayload> {
  readonly handles: EventType[]
  handle(event: DomainEvent<P>): Promise<void>
}
export interface EventSubscriber {
  readonly module: string
  readonly subscriptions: EventType[]
  onEvent(event: DomainEvent): Promise<void>
}
export interface EventDispatcher {
  register(subscriber: EventSubscriber): void
  dispatch(event: DomainEvent): Promise<void>
}

// ── Event Log (Part 6) — SÓ modelo. Nenhuma persistência. ──
export type EventLogStatus = 'published' | 'delivered' | 'handled' | 'failed' | 'skipped'

export type EventLogEntry = {
  id: string
  eventId: string
  type: EventType
  timestamp: string
  provider: string | null
  origin: string               // módulo de origem
  status: EventLogStatus
  durationMs: number | null
  payloadHash: string | null
  entity: { kind: string; id: string } | null
  userId: string | null
  teamId: string
  error: string | null
}
