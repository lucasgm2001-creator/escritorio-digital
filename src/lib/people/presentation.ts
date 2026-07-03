import type { CollaboratorStatus, TeamAccessRole } from './types'
import { formatDate } from '@/lib/utils'

// Apresentação compartilhada do domínio Pessoas (DS-009: evoluir/reutilizar antes de duplicar).
// Fonte única do estilo de status e das iniciais — consumida por CollaboratorCard e CollaboratorDetail.
export const COLLABORATOR_STATUS: Record<CollaboratorStatus, { label: string; cls: string }> = {
  ativo:     { label: 'Ativo',     cls: 'bg-lime/15 text-lime-fg border-lime/30' },
  inativo:   { label: 'Inativo',   cls: 'bg-bento-panel/60 text-bento-dim border-bento-border' },
  convidado: { label: 'Convidado', cls: 'bg-amber-900/20 text-amber-400 border-amber-800/40' },
  afastado:  { label: 'Afastado',  cls: 'bg-bento-panel/60 text-bento-muted border-bento-border' },
}

// Papel de ACESSO real na equipe (owner/admin/member) — badge compartilhado (card + detalhe). owner em
// destaque (lime), admin com ênfase neutra, member discreto. Owner e admin têm acesso total (PEOPLE-002).
export const TEAM_ROLE_BADGE: Record<TeamAccessRole, { label: string; cls: string }> = {
  owner:  { label: 'Owner',  cls: 'bg-lime/15 text-lime-fg border-lime/30' },
  admin:  { label: 'Admin',  cls: 'bg-bento-panel text-bento-text border-bento-border' },
  member: { label: 'Membro', cls: 'bg-bento-panel/60 text-bento-dim border-bento-border' },
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase() ?? '').join('')
}

// Data de ENTRADA na equipe (created_at do vínculo — timestamp; usa formatDate, não formatDateBR).
// Honesta quando o vínculo não tem data (não inventa): "Não configurado".
export function formatJoinedAt(iso: string | null): string {
  return iso ? formatDate(iso) : 'Não configurado'
}
