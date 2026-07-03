import type { DomainEvent, EventCategory, EventContext, EventPayload, EventPriority } from '../types'
import type { EventBus } from './EventBus'

// Helper de PUBLISHER: monta um DomainEvent completo a partir do mínimo. Roda como app code (browser/server),
// então crypto.randomUUID/Date são permitidos aqui.
export function createDomainEvent(
  type: string,
  category: EventCategory,
  payload: EventPayload,
  context: EventContext,
  opts?: { priority?: EventPriority; source?: string; entity?: DomainEvent['entity'] },
): DomainEvent {
  const id = globalThis.crypto?.randomUUID?.() ?? `evt_${Date.now()}_${Math.round(Math.random() * 1e6)}`
  return {
    id,
    type,
    category,
    context,
    metadata: {
      priority: opts?.priority ?? 'normal',
      source: { module: opts?.source ?? 'system' },
      targets: [],
      emittedAt: new Date().toISOString(),
      version: 1,
      payloadHash: null,
    },
    payload,
    entity: opts?.entity ?? null,
  }
}

// Publisher de EXEMPLO (EVENT-002, Part 6): publica `system.test`. SÓ demonstração — nenhum módulo real reage.
export function publishSystemTest(bus: EventBus, context: EventContext): DomainEvent {
  const event = createDomainEvent(
    'system.test', 'system',
    { note: 'Evento de teste do Event Center' },
    context,
    { source: 'Event Center', priority: 'low' },
  )
  bus.publish(event)
  return event
}

// Subscriber de EXEMPLO (EVENT-002, Part 7): reage a `system.test`. O "log em memória" é o callback recebido
// (a UI atualiza). Nada mais — nenhum outro efeito. Retorna o id (para unsubscribe e não vazar — Part 9).
export function registerSystemTestSubscriber(bus: EventBus, onReceived: (event: DomainEvent) => void): string {
  return bus.subscribe('SystemTestSubscriber', ['system.test'], onReceived)
}
