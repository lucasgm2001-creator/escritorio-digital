import type { CompensationAssignment, CompensationRule, CompensationTemplateDefinition } from './types'

// CATÁLOGO de templates/assignments (dados PUROS). Fonte única do seed — consumido pelo Repository
// (que carimba o team_id) e pelos exemplos. Sem banco (sem migration): quando o schema existir, o
// Repository troca o corpo por consultas; catálogo/engine não mudam.

export type TemplateBlueprint = Omit<CompensationTemplateDefinition, 'teamId'>
export type AssignmentBlueprint = Omit<CompensationAssignment, 'teamId'>

// Closer DR Growth: salário US$200; comissão 20% sobre o valor/semana (parcelada em até 4 semanas);
// upgrade = 20% da diferença; renovação = US$50 fixo. Reunião NÃO gera comissão (sem regra).
const CLOSER_RULES: CompensationRule[] = [
  { id: 'closer-salary', type: 'salary_fixed', on: 'salary', amount: 200 },
  { id: 'closer-commission', type: 'commission_percent', on: 'sale.created', rate: 0.20, weeksLimit: 4 },
  { id: 'closer-upgrade', type: 'upgrade_percent', on: 'upgrade.completed', rate: 0.20, weeksLimit: 4 },
  { id: 'closer-renewal', type: 'renewal_fixed', on: 'renewal.completed', amount: 50 },
]

export const CLOSER_DR_GROWTH: TemplateBlueprint = {
  id: 'tmpl-closer', name: 'Closer DR Growth', roleId: 'role-closer', version: 1, currency: 'USD', rules: CLOSER_RULES,
}

export const SDR_DR_GROWTH: TemplateBlueprint = {
  id: 'tmpl-sdr', name: 'SDR DR Growth', roleId: 'role-sdr', version: 1, currency: 'USD',
  rules: [
    { id: 'sdr-salary', type: 'salary_fixed', on: 'salary', amount: 150 },
    { id: 'sdr-meeting', type: 'commission_fixed', on: 'meeting.completed', amount: 10 },
  ],
}

export const TEMPLATE_CATALOG: TemplateBlueprint[] = [CLOSER_DR_GROWTH, SDR_DR_GROWTH]

// Assignments (colaborador → template). Alinhado ao seed de Pessoas (collab-2 = Bruno, Closer).
export const ASSIGNMENT_CATALOG: AssignmentBlueprint[] = [
  { id: 'asg-1', collaboratorId: 'collab-2', templateId: 'tmpl-closer', effectiveFrom: '2026-06-01T00:00:00Z' },
]
