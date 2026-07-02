import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import type { CollaboratorCardVM, CollaboratorDetailVM, DepartmentSummary, PeopleOverview, RoleSummary } from '@/lib/people/types'
import { listCollaborators, listDepartments, listRoles, listTemplates } from '@/server/repositories/PeopleRepository'

// Service do domínio Pessoas (ARCH-001). Garante o escopo da equipe ativa (TEAM-001) e COMPÕE os
// view-models a partir dos repositórios — a UI recebe pronto, sem fazer joins. É aqui que futuras
// verificações de permissão (PERMISSION-001) e vínculos de remuneração (COMPENSATION-001) entram.

async function loadScope(context: RequestContext) {
  const teamId = context.activeTeamId
  if (!teamId) return null
  const [departments, roles, templates, collaborators] = await Promise.all([
    listDepartments(teamId),
    listRoles(teamId),
    listTemplates(teamId),
    listCollaborators(teamId),
  ])
  return { departments, roles, templates, collaborators }
}

export async function getPeopleOverview(context: RequestContext): Promise<PeopleOverview> {
  const scope = await loadScope(context)
  if (!scope) return { departments: 0, roles: 0, templates: 0, collaborators: 0 }
  return {
    departments: scope.departments.length,
    roles: scope.roles.length,
    templates: scope.templates.length,
    collaborators: scope.collaborators.length,
  }
}

export async function listDepartmentSummaries(context: RequestContext): Promise<DepartmentSummary[]> {
  const scope = await loadScope(context)
  if (!scope) return []
  return scope.departments.map(department => ({
    ...department,
    roleCount: scope.roles.filter(role => role.departmentId === department.id).length,
    collaboratorCount: scope.collaborators.filter(collaborator => collaborator.departmentId === department.id).length,
  }))
}

export async function listRoleSummaries(context: RequestContext): Promise<RoleSummary[]> {
  const scope = await loadScope(context)
  if (!scope) return []
  return scope.roles.map(role => ({
    ...role,
    departmentName: scope.departments.find(department => department.id === role.departmentId)?.name ?? null,
    collaboratorCount: scope.collaborators.filter(collaborator => collaborator.roleId === role.id).length,
    suggestedTemplateName: scope.templates.find(template => template.id === role.suggestedTemplateId)?.name ?? null,
  }))
}

export async function listCollaboratorCards(context: RequestContext): Promise<CollaboratorCardVM[]> {
  const scope = await loadScope(context)
  if (!scope) return []
  return scope.collaborators.map(collaborator => ({
    id: collaborator.id,
    name: collaborator.name,
    email: collaborator.email,
    status: collaborator.status,
    departmentName: scope.departments.find(department => department.id === collaborator.departmentId)?.name ?? null,
    roleName: scope.roles.find(role => role.id === collaborator.roleId)?.name ?? null,
    templateName: scope.templates.find(template => template.id === collaborator.templateId)?.name ?? null,
    managerName: scope.collaborators.find(manager => manager.id === collaborator.managerId)?.name ?? null,
  }))
}

export async function getCollaboratorDetail(context: RequestContext, id: string): Promise<CollaboratorDetailVM | null> {
  const scope = await loadScope(context)
  if (!scope) return null
  const collaborator = scope.collaborators.find(item => item.id === id)
  if (!collaborator) return null
  const role = scope.roles.find(item => item.id === collaborator.roleId) ?? null
  return {
    id: collaborator.id,
    name: collaborator.name,
    email: collaborator.email,
    status: collaborator.status,
    departmentName: scope.departments.find(department => department.id === collaborator.departmentId)?.name ?? null,
    roleName: role?.name ?? null,
    roleDescription: role?.description ?? null,
    templateName: scope.templates.find(template => template.id === collaborator.templateId)?.name ?? null,
    managerName: scope.collaborators.find(manager => manager.id === collaborator.managerId)?.name ?? null,
  }
}
