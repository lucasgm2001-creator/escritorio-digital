import { EventBus } from './EventBus'

// Instância ÚNICA do processo (EVENT-002). Em memória; reutilizável por qualquer módulo no FUTURO
// (Timeline/Dashboard/Billing/Inbound/Notificações/IA/Integrações) sem alterar o EventBus (Part 10).
// Hoje nenhum módulo existente publica/assina — só o Event Center demonstra o runtime.
export const eventBus = new EventBus()

export { EventBus } from './EventBus'
export { EventRegistry, type EventListener, type EventSubscription } from './EventRegistry'
export { EventDispatcher } from './EventDispatcher'
export { EventLogger } from './EventLogger'
export { createDomainEvent, publishSystemTest, registerSystemTestSubscriber } from './examples'
