'use client'

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, Users, Ticket, ShieldCheck, Building2, ScrollText, Lock } from 'lucide-react'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { cn } from '@/lib/utils'
import { OverviewPanel } from './panels/OverviewPanel'
import { MembersPanel, type WorkspaceMember } from './panels/MembersPanel'
import { InvitesPanel, type WorkspaceInvite } from './panels/InvitesPanel'
import { TeamsPanel, type WorkspaceTeam } from './panels/TeamsPanel'
import { PermissionsPanel } from './panels/PermissionsPanel'
import { AuditPanel } from './panels/AuditPanel'
import { SecurityPanel } from './panels/SecurityPanel'
import type { WorkspaceRole } from './shared'

export type WorkspaceCenterProps = {
  teamName: string | null
  activeTeamName: string | null
  currentUserId: string
  currentRole: WorkspaceRole
  members: WorkspaceMember[]
  invites: WorkspaceInvite[]
  teams: WorkspaceTeam[]
  teamCount: number
  ownerName: string | null
}

// Abas do Workspace Center (Part 1), na ordem canônica completa.
type TabKey = 'overview' | 'members' | 'invites' | 'permissions' | 'teams' | 'audit' | 'security'
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Visão geral', icon: LayoutGrid },
  { key: 'members', label: 'Membros', icon: Users },
  { key: 'invites', label: 'Convites', icon: Ticket },
  { key: 'permissions', label: 'Permissões', icon: ShieldCheck },
  { key: 'teams', label: 'Equipes', icon: Building2 },
  { key: 'audit', label: 'Auditoria', icon: ScrollText },
  { key: 'security', label: 'Segurança', icon: Lock },
]

function isActiveInvite(inv: WorkspaceInvite): boolean {
  const expired = !!inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()
  return !inv.usedAt && !expired
}

// Centro de administração do workspace (TEAM-ADMIN-002). /admin/equipe. Aparência premium, muito espaço
// (Part 9). A gestão real reusa as server actions já existentes (nada de nova regra de negócio).
export function WorkspaceCenter(props: WorkspaceCenterProps) {
  const { teamName, activeTeamName, currentUserId, currentRole, members, invites, teams, teamCount, ownerName } = props
  const [tab, setTab] = useState<TabKey>('overview')

  const memberCount = members.length
  const adminCount = useMemo(() => members.filter(m => m.role === 'admin').length, [members])
  const activeInvites = useMemo(() => invites.filter(isActiveInvite).length, [invites])

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        breadcrumb={['Administração', 'Workspace']}
        title="Workspace"
        subtitle="Centro de administração da equipe — membros, convites, permissões e segurança."
      />

      {/* Barra de abas — rola no mobile, sem apertar (Part 9). */}
      <div className="border-b border-bento-border -mx-1 px-1 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map(t => {
            const Icon = t.icon
            const on = tab === t.key
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  on ? 'border-lime text-lime-fg' : 'border-transparent text-bento-dim hover:text-bento-text',
                )}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pt-1">
        {tab === 'overview' && (
          <OverviewPanel
            teamName={teamName} currentRole={currentRole} memberCount={memberCount} adminCount={adminCount}
            pendingInvites={activeInvites} teamCount={teamCount} ownerName={ownerName}
          />
        )}
        {tab === 'members' && (
          <MembersPanel members={members} currentUserId={currentUserId} currentRole={currentRole} teamName={teamName} activeTeamName={activeTeamName} />
        )}
        {tab === 'invites' && (
          <InvitesPanel invites={invites} teamName={teamName} />
        )}
        {tab === 'permissions' && (
          <PermissionsPanel currentRole={currentRole} />
        )}
        {tab === 'teams' && (
          <TeamsPanel teams={teams} />
        )}
        {tab === 'audit' && (
          <AuditPanel />
        )}
        {tab === 'security' && (
          <SecurityPanel currentRole={currentRole} teamName={teamName} teamCount={teamCount} memberCount={memberCount} />
        )}
      </div>
    </div>
  )
}
