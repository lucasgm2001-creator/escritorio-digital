import type { DomainEvent, EventType } from '../types'
import { EventRegistry, type EventListener } from './EventRegistry'
import { EventDispatcher } from './EventDispatcher'
import { EventLogger } from './EventLogger'

// Event Bus EM MEMÓRIA (EVENT-002) — combina EventRegistry + EventDispatcher + EventLogger. Sem fila, worker,
// cron, timer, persistência, banco, API externa. Provider-agnostic. É o PUBLISHER (publish) + a fachada da
// API pública (Part 8). Nenhum módulo existente o usa ainda — é só a fundação reutilizável.
export class EventBus {
  private readonly registry = new EventRegistry()
  private readonly dispatcher: EventDispatcher
  private readonly logger: EventLogger

  constructor(bufferCapacity = 100) {
    this.dispatcher = new EventDispatcher(this.registry)
    this.logger = new EventLogger(bufferCapacity)
  }

  // Publisher: registra no buffer + entrega aos subscribers. Retorna quantos receberam.
  publish(event: DomainEvent): number {
    this.logger.record(event)
    return this.dispatcher.dispatch(event)
  }

  // Entrega sem logar (uso avançado). publish() já chama internamente.
  dispatch(event: DomainEvent): number {
    return this.dispatcher.dispatch(event)
  }

  subscribe(module: string, types: EventType[], listener: EventListener): string {
    return this.registry.add(module, types, listener)
  }

  unsubscribe(id: string): boolean {
    return this.registry.remove(id)
  }

  getSubscribers(): { id: string; module: string; types: EventType[] }[] {
    return this.registry.list().map(({ id, module, types }) => ({ id, module, types }))
  }

  getRecentEvents(): DomainEvent[] {
    return this.logger.recent()
  }

  clear(): void {
    this.registry.clear()
    this.logger.clear()
  }
}
