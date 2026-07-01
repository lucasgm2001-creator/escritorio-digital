import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { TeamMembership, TeamRole, TeamSummary } from '@/lib/supabase/team'

export type TeamMember = {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  permissions: Record<string, unknown>
  created_at: string | null
  profile: {
    id: string
    name: string | null
    avatar_url: string | null
  } | null
}

export type TeamInvite = {
  id: string
  team_id: string
  token: string | null
  created_by: string | null
  used_by: string | null
  expires_at: string | null
  used_at: string | null
  created_at: string | null
}

type MembershipRow = Omit<TeamMembership, 'role' | 'permissions' | 'team'> & {
  role: string | null
  permissions: unknown
  team: TeamSummary | TeamSummary[] | null
}

type TeamMemberRow = Omit<TeamMember, 'role' | 'permissions' | 'profile'> & {
  role: string | null
  permissions: unknown
  profile: TeamMember['profile'] | TeamMember['profile'][] | null
}

function toTeamRole(role: string | null): TeamRole {
  return role === 'owner' || role === 'admin' || role === 'member' ? role : 'member'
}

function toPermissions(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function singleRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getMembershipsByUserId(userId: string): Promise<TeamMembership[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('team_members')
    .select('id, team_id, user_id, role, permissions, created_at, team:teams(id, name, owner_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as MembershipRow[]).map(row => ({
    id: row.id,
    team_id: row.team_id,
    user_id: row.user_id,
    role: toTeamRole(row.role),
    permissions: toPermissions(row.permissions),
    created_at: row.created_at,
    team: singleRelation(row.team),
  }))
}

export async function getTeamById(teamId: string): Promise<TeamSummary | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('teams')
    .select('id, name, owner_id')
    .eq('id', teamId)
    .maybeSingle()

  if (error) throw error

  return data as TeamSummary | null
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('team_members')
    .select('id, team_id, user_id, role, permissions, created_at, profile:profiles(id, name, avatar_url)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as TeamMemberRow[]).map(row => ({
    id: row.id,
    team_id: row.team_id,
    user_id: row.user_id,
    role: toTeamRole(row.role),
    permissions: toPermissions(row.permissions),
    created_at: row.created_at,
    profile: singleRelation(row.profile),
  }))
}

export async function getTeamInvites(teamId: string): Promise<TeamInvite[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('team_invites')
    .select('id, team_id, token, created_by, used_by, expires_at, used_at, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as TeamInvite[]
}

export async function createTeamInvite(
  teamId: string,
  createdBy: string,
): Promise<TeamInvite> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('team_invites')
    .insert({
      team_id: teamId,
      created_by: createdBy,
      token: crypto.randomUUID(),
    })
    .select('id, team_id, token, created_by, used_by, expires_at, used_at, created_at')
    .single()

  if (error) throw error

  return data as TeamInvite
}
