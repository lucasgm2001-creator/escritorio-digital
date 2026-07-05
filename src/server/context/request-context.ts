import 'server-only'

import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { getActiveTeam, type TeamMembership } from '@/lib/supabase/team'
import { getProfile, getSessionUser } from '@/lib/supabase/session'
import type { ModuleLevel, PermissionModule } from '@/lib/permissions/types'
import { parseModuleOverride, permissionLevels, resolveModuleAccess } from '@/lib/people/module-access'

export type RequestContextRole = 'guest' | 'member' | 'admin' | 'owner'

export type RequestContextProfile = {
  id: string
  name: string | null
  avatar_url: string | null
}

export type RequestContext = {
  user: User
  profile: RequestContextProfile | null
  activeTeamId: string | null
  activeTeamName: string | null
  membership: TeamMembership | null
  memberships: TeamMembership[]
  role: RequestContextRole
  roleKeys: string[]   // CARGOS do membro na equipe ativa (chaves do catálogo) — fonte única multi-cargo + gate do /admin
  // Autoridade de acesso (PERMISSIONS-002), resolvida NO SERVIDOR (papel → override → efetivo):
  //   moduleAccess  — nível efetivo por CHAVE de módulo (13 módulos) → navegação e guardas de rota
  //   moduleLevels  — projeção por PermissionModule → consumido pelo can() como autoridade
  moduleAccess: Record<string, ModuleLevel>
  moduleLevels: Partial<Record<PermissionModule, ModuleLevel>>
}

function toRequestContextRole(membership: TeamMembership | null): RequestContextRole {
  if (!membership) return 'guest'
  return membership.role
}

export const getRequestContext = cache(async (): Promise<RequestContext | null> => {
  const user = await getSessionUser()
  if (!user) return null

  const [profile, activeTeam] = await Promise.all([
    getProfile(user.id),
    getActiveTeam(user.id),
  ])

  const membership =
    activeTeam.memberships.find(item => item.team_id === activeTeam.activeTeamId)
    ?? null

  const role = toRequestContextRole(membership)
  // Autoridade de acesso resolvida uma única vez por request (cache do getRequestContext): papel + override
  // individual (team_members.permissions.modules) → níveis efetivos. owner/admin = admin em tudo; member =
  // override ?? leitura; guest = sem acesso. Nunca confia na UI — isto é a fonte que o can() aplica.
  const moduleOverride = parseModuleOverride(membership?.permissions)
  const moduleAccess = resolveModuleAccess(role, moduleOverride)
  const moduleLevels = permissionLevels(moduleAccess)

  return {
    user,
    profile: profile as RequestContextProfile | null,
    activeTeamId: activeTeam.activeTeamId,
    activeTeamName: activeTeam.activeTeamName,
    membership,
    memberships: activeTeam.memberships,
    role,
    roleKeys: membership?.roleKeys ?? [],
    moduleAccess,
    moduleLevels,
  }
})

export type SwitcherTeamView = {
  id: string
  name: string
  role: TeamMembership['role']
  isActive: boolean
}

// Projeta as equipes do usuário para o Workspace Switcher (id/nome/papel/ativa). FONTE ÚNICA da mesma
// leitura antes repetida em cada layout (dashboard/admin/tráfego/cliente) — TEAM-ADMIN-003 (dedup, Part 1).
export function switcherTeamsFromContext(context: RequestContext): SwitcherTeamView[] {
  return context.memberships.map(m => ({
    id: m.team_id,
    name: m.team?.name ?? 'Equipe',
    role: m.role,
    isActive: m.team_id === context.activeTeamId,
  }))
}
