import { DomainShell } from '@/components/domain/DomainShell'

// Casca da Administração — delega para a casca GENÉRICA de domínio (uma só implementação, sem duplicação).
export function AdminShell({ activeTeamName, userName, role, children }: {
  activeTeamName: string | null
  userName: string
  role: string
  children: React.ReactNode
}) {
  return (
    <DomainShell configKey="admin" subtitle={activeTeamName} userName={userName} role={role}>
      {children}
    </DomainShell>
  )
}
