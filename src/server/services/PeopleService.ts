import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CollaboratorCardVM, CollaboratorDetailVM, CollaboratorStatus, DepartmentSummary, PeopleOverview, RoleSummary } from '@/lib/people/types'
import { listDepartments, listRoles, listTemplates, getMemberRhFields, type MemberRhFields } from '@/server/repositories/PeopleRepository'
import { effectiveModuleMatrix, parseModuleOverride } from '@/lib/people/module-access'
import { getActiveTeamMembers } from '@/server/services/TeamService'
import type { TeamMember } from '@/server/repositories/TeamRepository'
import { roleByKey, departmentByKey, type DepartmentKey } from '@/lib/people/catalog'
import * as Compensation from '@/server/services/CompensationEngineService'
import type { CompensationAssignment, CompensationEvent, CompensationPreview, CompensationTemplateDefinition } from '@/core/compensation/types'

// Service do domínio Pessoas (ARCH-001). PEOPLE-002A: os COLABORADORES são REAIS — vêm de team_members +
// profiles (getActiveTeamMembers) e os fatos de RH (cargo/depto/gestor/entrada/status) da própria team_members
// (migration 044), resolvidos contra o catálogo OFICIAL de código. Sem seed, sem prévia, sem dado fictício.

function displayName(m: TeamMember): string {
  return m.profile?.name || m.profile?.email || 'Usuário sem nome'
}

// Projeta um membro real + seus fatos de RH no card. Cargo/depto vêm do catálogo (roleByKey/departmentByKey);
// gestor é resolvido pelo nome do membro correspondente. Campos ainda não configurados ficam null (honesto).
function memberToCard(m: TeamMember, rh: MemberRhFields | undefined, nameById: Map<string, string>): CollaboratorCardVM {
  // Cargos (MULTI, ACCESS-ROLES-001): fonte = role_keys; fallback ao role_key legado (primário). Primário = [0].
  const roleKeys = (Array.isArray(rh?.role_keys) && rh!.role_keys!.length ? rh!.role_keys! : (rh?.role_key ? [rh.role_key] : []))
  const roleNames = roleKeys.map(k => roleByKey(k)?.name ?? k)
  const primary = roleKeys[0] ? roleByKey(roleKeys[0]) : undefined
  const deptKey = (rh?.department_key ?? primary?.department) as DepartmentKey | undefined
  const dept = deptKey ? departmentByKey(deptKey) : undefined
  return {
    id: m.user_id, userId: m.user_id, name: displayName(m), email: m.profile?.email ?? null,
    avatarUrl: m.profile?.avatar_url ?? null, teamRole: m.role,
    joinedAt: rh?.joined_at ?? m.created_at,
    status: (rh?.status ?? 'ativo') as CollaboratorStatus,
    departmentName: dept?.name ?? null,
    roleName: primary?.name ?? (roleNames[0] ?? null),
    roleKeys,
    roleNames,
    templateName: null,   // remuneração real vem da engine (aba Remuneração) — não é campo de RH aqui
    managerName: rh?.manager_user_id ? (nameById.get(rh.manager_user_id) ?? null) : null,
  }
}

async function loadScope(context: RequestContext) {
  const teamId = context.activeTeamId
  if (!teamId) return null
  const [departments, roles, templates, members, rhFields] = await Promise.all([
    listDepartments(teamId),
    listRoles(teamId),
    listTemplates(),
    getActiveTeamMembers(context),   // COLABORADORES REAIS (team_members + profiles)
    getMemberRhFields(teamId),       // fatos de RH reais (migration 044)
  ])
  const nameById = new Map(members.map(m => [m.user_id, displayName(m)]))
  return { departments, roles, templates, members, rhFields, nameById }
}

export async function getPeopleOverview(context: RequestContext): Promise<PeopleOverview> {
  const scope = await loadScope(context)
  if (!scope) return { departments: 0, roles: 0, templates: 0, collaborators: 0 }
  return {
    departments: scope.departments.length,
    roles: scope.roles.length,
    templates: scope.templates.length,
    collaborators: scope.members.length,
  }
}

export async function listDepartmentSummaries(context: RequestContext): Promise<DepartmentSummary[]> {
  const scope = await loadScope(context)
  if (!scope) return []
  const rh = Array.from(scope.rhFields.values())
  return scope.departments.map(department => ({
    ...department,
    roleCount: scope.roles.filter(role => role.departmentId === department.id).length,
    collaboratorCount: rh.filter(r => r.department_key === department.id).length,   // real
  }))
}

export async function listRoleSummaries(context: RequestContext): Promise<RoleSummary[]> {
  const scope = await loadScope(context)
  if (!scope) return []
  const rh = Array.from(scope.rhFields.values())
  return scope.roles.map(role => ({
    ...role,
    departmentName: scope.departments.find(department => department.id === role.departmentId)?.name ?? null,
    collaboratorCount: rh.filter(r => r.role_key === role.id).length,   // real
    suggestedTemplateName: null,
  }))
}

export async function listCollaboratorCards(context: RequestContext): Promise<CollaboratorCardVM[]> {
  const scope = await loadScope(context)
  if (!scope) return []
  return scope.members.map(m => memberToCard(m, scope.rhFields.get(m.user_id), scope.nameById))
}

export async function getCollaboratorDetail(context: RequestContext, id: string): Promise<CollaboratorDetailVM | null> {
  const scope = await loadScope(context)
  if (!scope) return null
  const member = scope.members.find(m => m.user_id === id)
  if (!member) return null
  const rh = scope.rhFields.get(member.user_id)
  const role = rh?.role_key ? roleByKey(rh.role_key) : undefined
  // Matriz de acesso por módulo RESOLVIDA NO SERVIDOR (PERMISSIONS-002): papel → override → efetivo.
  return {
    ...memberToCard(member, rh, scope.nameById),
    roleDescription: role?.description ?? null,
    moduleMatrix: effectiveModuleMatrix(member.role, parseModuleOverride(member.permissions)),
  }
}

// ---- Integração com a Compensation Engine (COMPENSATION-004, PARTE 6). Só delega — nada calcula aqui. ----
export async function getCollaboratorTemplate(context: RequestContext, collaboratorId: string): Promise<CompensationTemplateDefinition | null> {
  return Compensation.getActiveTemplate(context, collaboratorId)
}

export async function getCollaboratorAssignment(context: RequestContext, collaboratorId: string): Promise<CompensationAssignment | null> {
  return Compensation.getActiveAssignment(context, collaboratorId)
}

export async function getCollaboratorCompensationPreview(
  context: RequestContext,
  collaboratorId: string,
  event: Omit<CompensationEvent, 'collaboratorId'>,
): Promise<CompensationPreview | null> {
  return Compensation.getPreview(context, collaboratorId, event)
}
