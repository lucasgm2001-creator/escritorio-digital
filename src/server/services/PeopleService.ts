import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CollaboratorCardVM, CollaboratorDetailVM, DepartmentSummary, PeopleOverview, RoleSummary } from '@/lib/people/types'
import { listDepartments, listRoles, listTemplates } from '@/server/repositories/PeopleRepository'
import { effectiveModuleMatrix, parseModuleOverride } from '@/lib/people/module-access'
import { getActiveTeamMembers } from '@/server/services/TeamService'
import type { TeamMember } from '@/server/repositories/TeamRepository'
import * as Compensation from '@/server/services/CompensationEngineService'
import type { CompensationAssignment, CompensationEvent, CompensationPreview, CompensationTemplateDefinition } from '@/core/compensation/types'

// Service do domínio Pessoas (ARCH-001). PEOPLE-002: os COLABORADORES são REAIS — vêm de team_members +
// profiles (via getActiveTeamMembers, 2 queries, sem N+1). Departamentos/cargos/templates seguem do catálogo
// (estrutura). Cargo/depto/gestor/template do colaborador ainda não são persistidos no RH → honestos (null).

// Colaborador REAL = membro da equipe. Nome: profile.name → email → fallback. Cargo/depto/etc. honestos.
function displayName(m: TeamMember): string {
  return m.profile?.name || m.profile?.email || 'Usuário sem nome'
}
function memberToCard(m: TeamMember): CollaboratorCardVM {
  return {
    id: m.user_id, userId: m.user_id, name: displayName(m), email: m.profile?.email ?? null,
    avatarUrl: m.profile?.avatar_url ?? null, teamRole: m.role, joinedAt: m.created_at, status: 'ativo',
    departmentName: null, roleName: null, templateName: null, managerName: null,
  }
}

async function loadScope(context: RequestContext) {
  const teamId = context.activeTeamId
  if (!teamId) return null
  const [departments, roles, templates, members] = await Promise.all([
    listDepartments(teamId),
    listRoles(teamId),
    listTemplates(teamId),
    getActiveTeamMembers(context),   // COLABORADORES REAIS (team_members + profiles)
  ])
  return { departments, roles, templates, members }
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
  return scope.departments.map(department => ({
    ...department,
    roleCount: scope.roles.filter(role => role.departmentId === department.id).length,
    // Colaboradores reais ainda não têm departamento de RH atribuído (sem persistência) → honesto: 0.
    collaboratorCount: 0,
  }))
}

export async function listRoleSummaries(context: RequestContext): Promise<RoleSummary[]> {
  const scope = await loadScope(context)
  if (!scope) return []
  return scope.roles.map(role => ({
    ...role,
    departmentName: scope.departments.find(department => department.id === role.departmentId)?.name ?? null,
    collaboratorCount: 0,   // sem cargo de RH atribuído aos membros reais ainda → honesto
    suggestedTemplateName: scope.templates.find(template => template.id === role.suggestedTemplateId)?.name ?? null,
  }))
}

export async function listCollaboratorCards(context: RequestContext): Promise<CollaboratorCardVM[]> {
  const scope = await loadScope(context)
  if (!scope) return []
  return scope.members.map(memberToCard)
}

export async function getCollaboratorDetail(context: RequestContext, id: string): Promise<CollaboratorDetailVM | null> {
  const scope = await loadScope(context)
  if (!scope) return null
  const member = scope.members.find(m => m.user_id === id)
  if (!member) return null
  // Cargo/depto de RH ainda não persistidos → honestos (null); papel/entrada/foto/email são reais.
  // Matriz de acesso por módulo RESOLVIDA NO SERVIDOR (PERMISSIONS-002): papel → override individual
  // (team_members.permissions.modules) → efetivo. owner/admin = admin sempre; member = override ?? leitura.
  return {
    ...memberToCard(member),
    roleDescription: null,
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
