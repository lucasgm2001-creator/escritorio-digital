import { DomainShell } from '@/components/domain/DomainShell'
import type { SwitcherTeam } from '@/components/layout/WorkspaceSwitcher'

// Casca da Administração — delega para a casca GENÉRICA de domínio (uma só implementação, sem duplicação).
// A filtragem de seções vem por CHAVES (visibleSectionKeys — serializável): o /admin/layout decide o que o usuário
// vê (owner/dev = tudo → undefined; membro com módulo Clientes = ['clientes']). O DomainShell (client) resolve os
// ícones do registro e filtra — NUNCA passamos o config com ícones do servidor (HOTFIX-ADMIN-001).
export function AdminShell({ activeTeamName, userName, role, userEmail = null, avatarUrl = null, teams = [], visibleSectionKeys, children }: {
  activeTeamName: string | null
  userName: string
  role: string
  userEmail?: string | null
  avatarUrl?: string | null
  teams?: SwitcherTeam[]
  visibleSectionKeys?: string[]
  children: React.ReactNode
}) {
  return (
    <DomainShell configKey="admin" visibleSectionKeys={visibleSectionKeys} subtitle={activeTeamName} userName={userName} role={role} userEmail={userEmail} avatarUrl={avatarUrl} teams={teams}>
      {children}
    </DomainShell>
  )
}
