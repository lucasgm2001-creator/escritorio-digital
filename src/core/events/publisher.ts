import type { EventPublisher } from './types'

// Publisher NO-OP da fase de fundação: honra o contrato mas não entrega (sem Event Bus / Outbox ainda).
// Quando o Outbox + worker existirem, SÓ esta implementação muda — quem publica eventos não muda.
export const noopEventPublisher: EventPublisher = {
  async publish(): Promise<void> {
    // Intencional: fundação. Sem efeitos colaterais nesta fase.
  },
}
