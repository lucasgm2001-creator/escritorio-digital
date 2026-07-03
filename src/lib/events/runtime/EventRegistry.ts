import type { DomainEvent, EventType } from '../types'

export type EventListener = (event: DomainEvent) => void
export type EventSubscription = { id: string; module: string; types: EventType[]; listener: EventListener }

// Registro EM MEMÓRIA de subscribers (EVENT-002, Part 3). Índices: Map(type → Set) para casar rápido por
// tipo, Set('*') para wildcard, e Map(id → sub) para remoção O(1). Remover um subscriber o tira de TODOS os
// índices (Part 9 — sem vazamento; um subscriber removido realmente sai). Sem timers/polling.
export class EventRegistry {
  private readonly byType = new Map<EventType, Set<EventSubscription>>()
  private readonly wildcard = new Set<EventSubscription>()
  private readonly byId = new Map<string, EventSubscription>()
  private seq = 0

  add(module: string, types: EventType[], listener: EventListener): string {
    const id = `sub_${++this.seq}`
    const sub: EventSubscription = { id, module, types, listener }
    this.byId.set(id, sub)
    for (const t of types) {
      if (t === '*') { this.wildcard.add(sub); continue }
      let set = this.byType.get(t)
      if (!set) { set = new Set(); this.byType.set(t, set) }
      set.add(sub)
    }
    return id
  }

  remove(id: string): boolean {
    const sub = this.byId.get(id)
    if (!sub) return false
    this.byId.delete(id)
    this.wildcard.delete(sub)
    for (const t of sub.types) {
      const set = this.byType.get(t)
      if (set) { set.delete(sub); if (set.size === 0) this.byType.delete(t) }   // limpa Map vazio (sem leak)
    }
    return true
  }

  // Subscribers interessados em um tipo: os do tipo exato + os wildcard ('*'). Dedup por id.
  match(type: EventType): EventSubscription[] {
    const set = this.byType.get(type)
    const combined = Array.from(this.wildcard).concat(set ? Array.from(set) : [])
    const seen = new Set<string>()
    const out: EventSubscription[] = []
    for (const sub of combined) {
      if (!seen.has(sub.id)) { seen.add(sub.id); out.push(sub) }
    }
    return out
  }

  list(): EventSubscription[] {
    return Array.from(this.byId.values())
  }

  clear(): void {
    this.byType.clear()
    this.wildcard.clear()
    this.byId.clear()
  }
}
