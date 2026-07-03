'use client'

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, Users, Ticket } from 'lucide-react'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { cn } from '@/lib/utils'
import { OverviewPanel } from './panels/OverviewPanel'
import { MembersPanel, type WorkspaceMember } from './panels/MembersPanel'
import { InvitesPanel, type WorkspaceInvite } from './panels/InvitesPanel'
import type { WorkspaceRole } from './shared'

export type WorkspaceCenterProps = {
  teamName: string | null
  activeTeamName: string | null
  currentUserId: string
  currentRole: WorkspaceRole
  members: WorkspaceMember[]
  invites: WorkspaceInvite[]
  teamCount: number
  ownerName: string | null
}

// Abas do Workspace Center (Part 1). A ordem canônica é fixa; cada commit acende a sua aba (sem aba vazia /
// "em breve"). Commit atual: Visão geral · Membros · Convites. As demais entram nos próximos commits.
type TabKey = 'overview' | 'members' | 'invites'
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Visão geral', icon: LayoutGrid },
  { key: 'members', label: 'Membros', icon: Users },
  { key: 'invites', label: 'Convites', icon: Ticket },
]

function isActiveInvite(inv: WorkspaceInvite): boolean {
  const expired = !!inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()
  return !inv.usedAt && !expired
}

// Centro de administração do workspace (TEAM-ADMIN-002). /admin/equipe. Aparência premium, muito espaço
// (Part 9). A gestão real reusa as server actions já existentes (nada de nova regra de negócio).
export function WorkspaceCenter(props: WorkspaceCenterProps) {
  const { teamName, activeTeamName, currentUserId, currentRole, members, invites, teamCount, ownerName } = props
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
      </div>
    </div>
  )
}
