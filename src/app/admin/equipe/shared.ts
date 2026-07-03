// Helpers compartilhados do Workspace Center (TEAM-ADMIN-002). Pequenos e puros — nome/data/rótulos de papel
// usados pelos painéis (Membros, Convites, Equipes...). Evita repetir a mesma formatação em cada aba.

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

// Estilo do badge de papel — hierarquia visível (owner destaque, admin secundário, member neutro).
export const ROLE_BADGE: Record<WorkspaceRole, string> = {
  owner: 'border-lime/40 bg-lime/10 text-lime-fg',
  admin: 'border-blue-400/40 bg-blue-400/10 text-blue-300',
  member: 'border-bento-border bg-bento-bg text-bento-dim',
}

// Iniciais para o avatar (nunca o user_id). "Ana Souza" → "AS", "gabriel" → "GA", vazio → "?".
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}
