import type { WorkspaceAuditEvent } from '@/lib/events/audit'

// Redação das notificações de workspace (TEAM-ADMIN-002, Part 8). Funções PURAS — só transformam um evento
// de auditoria (Part 7) em texto humano. NADA é enviado/persistido. Duas vozes: 3ª pessoa (feed/auditoria)
// e 2ª pessoa (para o destinatário — "Você entrou na equipe DR Growth.").

const ROLE_PT: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }

function actorName(name: string | null): string {
  return name?.trim() || 'Alguém'
}
function subjectName(name: string | null): string {
  return name?.trim() || 'um membro'
}
function role(r: string): string {
  return ROLE_PT[r] ?? r
}

// Frase em 3ª pessoa — para o feed de auditoria / visão do admin.
// Ex.: "Lucas promoveu Gabriel para Admin." · "Daniel transferiu ownership."
export function describeWorkspaceAudit(event: WorkspaceAuditEvent): string {
  const p = event.payload
  const team = event.teamName?.trim() || 'a equipe'
  switch (p.type) {
    case 'workspace.member_promoted':
      return `${actorName(p.actor.name)} promoveu ${subjectName(p.subject.name)} para ${role(p.to)}.`
    case 'workspace.member_demoted':
      return `${actorName(p.actor.name)} rebaixou ${subjectName(p.subject.name)} para ${role(p.to)}.`
    case 'workspace.owner_transferred':
      return `${actorName(p.actor.name)} transferiu ownership para ${subjectName(p.subject.name)}.`
    case 'workspace.invite_accepted':
      return `${actorName(p.actor.name)} entrou na equipe ${team}.`
    case 'workspace.invite_revoked':
      return `${actorName(p.actor.name)} revogou um convite.`
    case 'workspace.member_removed':
      return `${actorName(p.actor.name)} removeu ${subjectName(p.subject.name)} da equipe.`
    case 'workspace.created':
      return `${actorName(p.actor.name)} criou a equipe ${team}.`
    case 'workspace.left':
      return p.promoted
        ? `${actorName(p.actor.name)} saiu da equipe. ${subjectName(p.promoted.name)} assumiu como owner.`
        : `${actorName(p.actor.name)} saiu da equipe.`
  }
}

// Frase em 2ª pessoa — para quem VAI LER (viewerId). Personaliza quando o leitor é o ator ou o sujeito.
// Ex.: "Você entrou na equipe DR Growth." · "Você foi promovido para Admin."
export function describeWorkspaceAuditForViewer(event: WorkspaceAuditEvent, viewerId: string): string {
  const p = event.payload
  const team = event.teamName?.trim() || 'a equipe'
  const iAmActor = p.actor.userId != null && p.actor.userId === viewerId

  switch (p.type) {
    case 'workspace.member_promoted':
      if (p.subject.userId === viewerId) return `Você foi promovido para ${role(p.to)}.`
      return `${actorName(p.actor.name)} promoveu ${subjectName(p.subject.name)} para ${role(p.to)}.`
    case 'workspace.member_demoted':
      if (p.subject.userId === viewerId) return `Você foi rebaixado para ${role(p.to)}.`
      return `${actorName(p.actor.name)} rebaixou ${subjectName(p.subject.name)} para ${role(p.to)}.`
    case 'workspace.owner_transferred':
      if (p.subject.userId === viewerId) return `Você agora é o owner da equipe ${team}.`
      return `${actorName(p.actor.name)} transferiu ownership para ${subjectName(p.subject.name)}.`
    case 'workspace.invite_accepted':
      return iAmActor ? `Você entrou na equipe ${team}.` : `${actorName(p.actor.name)} entrou na equipe ${team}.`
    case 'workspace.invite_revoked':
      return `${actorName(p.actor.name)} revogou um convite.`
    case 'workspace.member_removed':
      if (p.subject.userId === viewerId) return `Você foi removido da equipe ${team}.`
      return `${actorName(p.actor.name)} removeu ${subjectName(p.subject.name)} da equipe.`
    case 'workspace.created':
      return iAmActor ? `Você criou a equipe ${team}.` : `${actorName(p.actor.name)} criou a equipe ${team}.`
    case 'workspace.left':
      if (iAmActor) return `Você saiu da equipe ${team}.`
      return p.promoted
        ? `${actorName(p.actor.name)} saiu da equipe. ${subjectName(p.promoted.name)} assumiu como owner.`
        : `${actorName(p.actor.name)} saiu da equipe.`
  }
}
