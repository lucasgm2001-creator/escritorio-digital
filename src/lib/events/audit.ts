import type { EventType } from './types'

// Contratos de AUDITORIA de workspace (TEAM-ADMIN-002, Part 7). SÓ contratos — nada é gravado nem publicado
// ainda. Descrevem "quem fez o quê com quem" em cada evento de governança da equipe. Quando o runtime de
// auditoria existir, viram DomainEvent no Event Bus (os `type` já batem com o EVENT_CATALOG) e alimentam
// Notificações (Part 8, ver lib/notifications). NÃO tocam banco/regra de negócio.

export type WorkspaceAuditType =
  | 'workspace.member_promoted'
  | 'workspace.member_demoted'
  | 'workspace.owner_transferred'
  | 'workspace.invite_accepted'
  | 'workspace.invite_revoked'
  | 'workspace.member_removed'
  | 'workspace.created'
  | 'workspace.left'

export type TeamRoleName = 'owner' | 'admin' | 'member'

// Ator = quem executou (null = sistema/automação). Sujeito = quem sofreu a ação (quando aplicável).
export type WorkspaceActor = { userId: string | null; name: string | null }
export type WorkspaceSubject = { userId: string; name: string | null }

// Payload por tipo — união discriminada por `type`. Cada variante carrega só o necessário para auditar e
// para redigir a notificação humana (Part 8).
export type WorkspaceAuditPayload =
  | { type: 'workspace.member_promoted';   actor: WorkspaceActor; subject: WorkspaceSubject; from: TeamRoleName; to: TeamRoleName }
  | { type: 'workspace.member_demoted';    actor: WorkspaceActor; subject: WorkspaceSubject; from: TeamRoleName; to: TeamRoleName }
  | { type: 'workspace.owner_transferred'; actor: WorkspaceActor; subject: WorkspaceSubject }
  | { type: 'workspace.invite_accepted';   actor: WorkspaceActor }
  | { type: 'workspace.invite_revoked';    actor: WorkspaceActor; inviteId: string }
  | { type: 'workspace.member_removed';    actor: WorkspaceActor; subject: WorkspaceSubject }
  | { type: 'workspace.created';           actor: WorkspaceActor }
  | { type: 'workspace.left';              actor: WorkspaceActor; promoted: WorkspaceSubject | null }

// Envelope de auditoria — o evento já contextualizado na equipe. `at` é ISO carimbado por quem cria o
// registro (não gerar tempo aqui, para manter puro/determinístico).
export type WorkspaceAuditEvent = {
  type: WorkspaceAuditType
  teamId: string
  teamName: string | null
  at: string
  payload: WorkspaceAuditPayload
}

// Ponte com o Event Bus: o `type` da auditoria É um EventType do catálogo (mesma string canônica).
export function auditEventType(type: WorkspaceAuditType): EventType {
  return type
}
