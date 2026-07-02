// Fundação de NOTIFICAÇÕES (Constituição, Título 4 — Notification Engine). Só contratos; nada é enviado.

export type NotificationType = 'info' | 'success' | 'warning' | 'alert'

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'webhook'

export type NotificationTarget =
  | { kind: 'user'; userId: string }
  | { kind: 'team'; teamId: string }
  | { kind: 'role'; teamId: string; role: string }

export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  body: string | null
  target: NotificationTarget
  channels: NotificationChannel[]
  createdAt: string
}

// Envia (roteando por canal/target). Fundação: define o contrato; a entrega chega numa etapa futura.
export interface NotificationSender {
  send(notification: AppNotification): Promise<void>
}
