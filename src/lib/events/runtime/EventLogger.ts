import type { DomainEvent } from '../types'

// Buffer circular EM MEMÓRIA dos últimos N eventos (EVENT-002, Part 4). NÃO grava/persiste nada — só mantém
// os últimos `capacity` em um array limitado (sem vazamento — Part 9). Reset via clear().
export class EventLogger {
  private buffer: DomainEvent[] = []

  constructor(private readonly capacity = 100) {}

  record(event: DomainEvent): void {
    this.buffer.push(event)
    if (this.buffer.length > this.capacity) this.buffer = this.buffer.slice(-this.capacity)
  }

  recent(): DomainEvent[] {
    return [...this.buffer].reverse()   // mais recente primeiro
  }

  count(): number {
    return this.buffer.length
  }

  clear(): void {
    this.buffer = []
  }
}
