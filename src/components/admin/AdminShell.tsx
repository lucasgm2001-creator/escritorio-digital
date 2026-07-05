import { DomainShell } from '@/components/domain/DomainShell'
import type { DomainConfig } from '@/lib/domain/nav'
import type { SwitcherTeam } from '@/components/layout/WorkspaceSwitcher'

// Casca da Administração — delega para a casca GENÉRICA de domínio (uma só implementação, sem duplicação).
// Recebe um `config` já resolvido no servidor (CLIENT-HISTORY-ADMIN-003): o /admin/layout filtra as seções pelo
// que o usuário pode ver (owner/dev = tudo; membro com módulo Clientes = só Clientes). Sem config → registro estático.
export function AdminShell({ activeTeamName, userName, role, userEmail = null, avatarUrl = null, teams = [], config, children }: {
  activeTeamName: string | null
  userName: string
  role: string
  userEmail?: string | null
  avatarUrl?: string | null
  teams?: SwitcherTeam[]
  config?: DomainConfig
  children: React.ReactNode
}) {
  return (
    <DomainShell configKey={config ? undefined : 'admin'} config={config} subtitle={activeTeamName} userName={userName} role={role} userEmail={userEmail} avatarUrl={avatarUrl} teams={teams}>
      {children}
    </DomainShell>
  )
}
