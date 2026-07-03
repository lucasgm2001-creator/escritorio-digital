import type { DomainEvent } from '../types'
import type { EventRegistry } from './EventRegistry'

// Entrega um evento aos subscribers que casam (EVENT-002, Part 2). SÍNCRONO, em memória — sem fila, worker,
// timer ou retry. Isola erros: um subscriber que lança NÃO derruba os demais nem o publisher. Retorna
// quantos subscribers receberam.
export class EventDispatcher {
  constructor(private readonly registry: EventRegistry) {}

  dispatch(event: DomainEvent): number {
    const subs = this.registry.match(event.type)
    for (const sub of subs) {
      try {
        sub.listener(event)
      } catch {
        // Isolado de propósito — a falha de um subscriber não afeta os outros nem quem publicou.
      }
    }
    return subs.length
  }
}
