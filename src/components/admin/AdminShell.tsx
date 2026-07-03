import { DomainShell } from '@/components/domain/DomainShell'
import type { SwitcherTeam } from '@/components/layout/WorkspaceSwitcher'

// Casca da Administração — delega para a casca GENÉRICA de domínio (uma só implementação, sem duplicação).
export function AdminShell({ activeTeamName, userName, role, userEmail = null, avatarUrl = null, teams = [], children }: {
  activeTeamName: string | null
  userName: string
  role: string
  userEmail?: string | null
  avatarUrl?: string | null
  teams?: SwitcherTeam[]
  children: React.ReactNode
}) {
  return (
    <DomainShell configKey="admin" subtitle={activeTeamName} userName={userName} role={role} userEmail={userEmail} avatarUrl={avatarUrl} teams={teams}>
      {children}
    </DomainShell>
  )
}
