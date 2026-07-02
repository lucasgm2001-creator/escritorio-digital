import 'server-only'

import type { NotificationSender } from '@/core/notifications/types'

// STUB de fundação: honra o contrato de envio, mas NÃO envia (sem canais conectados nesta fase).
// Quando os canais (in_app/email/push/webhook) existirem, só esta implementação muda.
export const notificationService: NotificationSender = {
  async send(): Promise<void> {
    // Intencional: fundação. Sem envio nesta fase.
  },
}
