import type { WorkspaceAuditEvent, WorkspaceAuditType } from '@/lib/events/audit'
import { describeWorkspaceAudit } from './messages'

// Arquitetura de NOTIFICAÇÕES (TEAM-ADMIN-002, Part 8). SÓ contratos + rascunho — NADA é enviado ou
// persistido. Quando o runtime existir, um WorkspaceAuditEvent (Part 7) vira uma ou mais Notification e o
// canal (in-app/email/push) cuida da entrega. Aqui só modelamos e mostramos a ponte auditoria → notificação.

export type NotificationChannel = 'in_app' | 'email' | 'push'
export type NotificationLevel = 'info' | 'success' | 'warning' | 'critical'

// Para quem vai a notificação — um usuário, toda a equipe, ou só os admins/owner.
export type NotificationRecipient =
  | { kind: 'user'; userId: string }
  | { kind: 'team'; teamId: string }
  | { kind: 'team_admins'; teamId: string }

export type Notification = {
  id: string
  level: NotificationLevel
  title: string
  body: string | null
  recipient: NotificationRecipient
  channels: NotificationChannel[]
  sourceEventType: string | null   // liga de volta à auditoria/Event Bus
  createdAt: string
  readAt: string | null
}

// Rascunho: o que dá para saber SEM runtime (id/createdAt/readAt são carimbados na entrega futura).
export type NotificationDraft = Omit<Notification, 'id' | 'createdAt' | 'readAt'>

// Contrato do runtime futuro — sem implementação.
export interface NotificationSender {
  send(notification: Notification): Promise<void>
}

// Nível por tipo de auditoria (severidade da governança).
const LEVEL_BY_TYPE: Record<WorkspaceAuditType, NotificationLevel> = {
  'workspace.member_promoted': 'success',
  'workspace.member_demoted': 'info',
  'workspace.owner_transferred': 'warning',
  'workspace.invite_accepted': 'success',
  'workspace.invite_revoked': 'info',
  'workspace.member_removed': 'warning',
  'workspace.created': 'info',
  'workspace.left': 'info',
}

export function notificationLevelFor(type: WorkspaceAuditType): NotificationLevel {
  return LEVEL_BY_TYPE[type]
}

// Ponte auditoria → notificação (rascunho). Escolhe o destinatário mais relevante por tipo: quando há um
// sujeito impactado, avisa o sujeito; senão, avisa os admins da equipe. O texto vem do formatter puro
// (Part 8). NÃO envia — só descreve o que o runtime enviaria.
export function draftNotificationForAudit(event: WorkspaceAuditEvent): NotificationDraft {
  const p = event.payload
  const level = notificationLevelFor(p.type)
  const title = describeWorkspaceAudit(event)

  const recipient: NotificationRecipient =
    'subject' in p
      ? { kind: 'user', userId: p.subject.userId }
      : { kind: 'team_admins', teamId: event.teamId }

  return {
    level,
    title,
    body: null,
    recipient,
    channels: ['in_app'],
    sourceEventType: p.type,
  }
}
