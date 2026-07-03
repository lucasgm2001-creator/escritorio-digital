'use client'

import { DomainShell } from '@/components/domain/DomainShell'
import type { SwitcherTeam } from '@/components/layout/WorkspaceSwitcher'
import { buildClientConfig } from '@/lib/client/sections'

// Casca do Workspace do Cliente — REUSA a casca genérica (DomainShell). O config é montado no cliente
// (hrefs por id + ícones resolvidos aqui), evitando passar funções server→client.
export function ClientWorkspaceShell({ clientId, clientName, subtitle, userName, role, userEmail = null, avatarUrl = null, teams = [], children }: {
  clientId: string
  clientName: string
  subtitle: string | null
  userName: string
  role: string
  userEmail?: string | null
  avatarUrl?: string | null
  teams?: SwitcherTeam[]
  children: React.ReactNode
}) {
  return (
    <DomainShell config={buildClientConfig(clientId, clientName)} subtitle={subtitle} userName={userName} role={role} userEmail={userEmail} avatarUrl={avatarUrl} teams={teams}>
      {children}
    </DomainShell>
  )
}
