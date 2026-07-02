import 'server-only'

import type { CompensationAssignment, CompensationTemplateDefinition } from '@/core/compensation/types'
import { ASSIGNMENT_CATALOG, TEMPLATE_CATALOG } from '@/core/compensation/catalog'

// Repository da Compensation Engine (ARCH-001). A ENGINE nunca toca o banco — quem acessa dados é aqui.
// Fase de fundação: serve o CATÁLOGO em memória (sem migration), carimbando o team_id (TEAM-001).
// Quando as tabelas existirem, só o corpo destes métodos muda; assinaturas e engine permanecem.

export async function listTemplates(teamId: string): Promise<CompensationTemplateDefinition[]> {
  return TEMPLATE_CATALOG.map(template => ({ ...template, teamId }))
}

export async function getTemplateById(teamId: string, templateId: string): Promise<CompensationTemplateDefinition | null> {
  const template = TEMPLATE_CATALOG.find(item => item.id === templateId)
  return template ? { ...template, teamId } : null
}

export async function getActiveAssignment(teamId: string, collaboratorId: string): Promise<CompensationAssignment | null> {
  const assignment = ASSIGNMENT_CATALOG.find(item => item.collaboratorId === collaboratorId)
  return assignment ? { ...assignment, teamId } : null
}
