import 'server-only'

import type { CompensationTemplate, Department, Role } from '@/lib/people/types'

// Camada de dados do domínio Pessoas (ARCH-001). Nesta fase serve um CATÁLOGO/PRÉVIA em memória —
// NÃO toca o banco. Quando o schema existir, só o corpo de cada método passa a consultar o Supabase
// por team_id; as assinaturas não mudam (zero retrabalho em Service/UI). Multi-tenant (TEAM-001).

function seedDepartments(teamId: string): Department[] {
  const d = (id: string, name: string, description: string): Department => ({ id: `dept-${id}`, teamId, name, description })
  return [
    d('comercial', 'Comercial', 'Aquisição, funil e fechamento de vendas.'),
    d('financeiro', 'Financeiro', 'Receita, pagamentos e controle financeiro.'),
    d('marketing', 'Marketing', 'Conteúdo, campanhas e geração de demanda.'),
    d('operacoes', 'Operações', 'Entrega, processos e eficiência operacional.'),
    d('administrativo', 'Administrativo', 'Rotinas administrativas e suporte interno.'),
    d('tecnologia', 'Tecnologia', 'Produto, engenharia e infraestrutura.'),
    d('atendimento', 'Atendimento', 'Sucesso do cliente e suporte pós-venda.'),
    d('rh', 'RH', 'Pessoas, cultura e desenvolvimento.'),
  ]
}

function seedRoles(teamId: string): Role[] {
  const r = (
    id: string, departmentId: string | null, name: string, description: string,
    suggestedTemplateId: string | null = null, isCustom = false,
  ): Role => ({ id: `role-${id}`, teamId, departmentId, name, description, isCustom, suggestedTemplateId })
  return [
    r('closer', 'dept-comercial', 'Closer', 'Conduz e fecha as vendas.', 'tmpl-closer'),
    r('sdr', 'dept-comercial', 'SDR', 'Qualifica e agenda oportunidades.', 'tmpl-sdr'),
    r('manager', 'dept-comercial', 'Manager', 'Lidera o time e acompanha metas.'),
    r('analista', 'dept-financeiro', 'Analista', 'Analisa dados e processos.'),
    r('designer', 'dept-marketing', 'Designer', 'Cria peças e experiências visuais.'),
    r('gestor', 'dept-administrativo', 'Gestor', 'Coordena rotinas e recursos.'),
    r('assistente', 'dept-atendimento', 'Assistente', 'Apoia a operação e o cliente.'),
    r('custom', null, 'Custom', 'Cargo personalizado da empresa.', null, true),
  ]
}

function seedTemplates(teamId: string): CompensationTemplate[] {
  return [
    { id: 'tmpl-closer', teamId, name: 'Closer DR Growth', roleId: 'role-closer' },
    { id: 'tmpl-sdr', teamId, name: 'SDR DR Growth', roleId: 'role-sdr' },
  ]
}

// PEOPLE-002: colaboradores fictícios REMOVIDOS — os colaboradores reais vêm de team_members + profiles
// (PeopleService.getActiveTeamMembers). Departamentos/cargos/templates seguem como catálogo/estrutura.

export async function listDepartments(teamId: string): Promise<Department[]> {
  return seedDepartments(teamId)
}

export async function listRoles(teamId: string): Promise<Role[]> {
  return seedRoles(teamId)
}

export async function listTemplates(teamId: string): Promise<CompensationTemplate[]> {
  return seedTemplates(teamId)
}
