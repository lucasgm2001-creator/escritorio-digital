import type { CollaboratorStatus } from './types'

// Apresentação compartilhada do domínio Pessoas (DS-009: evoluir/reutilizar antes de duplicar).
// Fonte única do estilo de status e das iniciais — consumida por CollaboratorCard e CollaboratorDetail.
export const COLLABORATOR_STATUS: Record<CollaboratorStatus, { label: string; cls: string }> = {
  ativo:     { label: 'Ativo',     cls: 'bg-lime/15 text-lime-fg border-lime/30' },
  inativo:   { label: 'Inativo',   cls: 'bg-bento-panel/60 text-bento-dim border-bento-border' },
  convidado: { label: 'Convidado', cls: 'bg-amber-900/20 text-amber-400 border-amber-800/40' },
  afastado:  { label: 'Afastado',  cls: 'bg-bento-panel/60 text-bento-muted border-bento-border' },
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase() ?? '').join('')
}
