import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { CompensationTemplate, Department, Role } from '@/lib/people/types'
import { DEPARTMENT_CATALOG, ROLE_CATALOG } from '@/lib/people/catalog'

// Camada de dados do domínio Pessoas (ARCH-001). PEOPLE-002A: o SEED em memória foi eliminado. A ESTRUTURA
// (departamentos/cargos) vem do catálogo OFICIAL de código (lib/people/catalog) e os fatos de RH do colaborador
// (cargo/depto/gestor/entrada/status) vêm do BANCO (team_members, migration 044). Nada fictício.

// Estrutura oficial projetada nos VMs do domínio (id = chave do catálogo; não há tabela de estrutura).
export async function listDepartments(teamId: string): Promise<Department[]> {
  return DEPARTMENT_CATALOG.map(d => ({ id: d.key, teamId, name: d.name, description: d.description }))
}

export async function listRoles(teamId: string): Promise<Role[]> {
  return ROLE_CATALOG.map(r => ({
    id: r.key, teamId, departmentId: r.department, name: r.name, description: r.description,
    isCustom: false, suggestedTemplateId: null,
  }))
}

// Templates de remuneração NÃO são catálogo de estrutura: vivem na engine de compensação
// (collaborator_compensation_settings / CompensationRepository). Aqui é sempre vazio — honesto.
export async function listTemplates(): Promise<CompensationTemplate[]> {
  return []
}

// ── Fatos de RH por colaborador (team_members, migration 044) ──────────────────────────────────────────
// Leitura escopada à equipe. Client do usuário + RLS (a tela é gated a owner/admin nos callers), mesmo
// padrão do getTeamMembers. NÃO altera TeamService/TeamRepository — leitura própria do domínio Pessoas.
export type MemberRhFields = {
  user_id: string
  role_key: string | null
  role_keys: string[] | null   // MULTI-cargo (ACCESS-ROLES-001) — fonte única
  department_key: string | null
  manager_user_id: string | null
  joined_at: string | null
  status: string | null
}

export async function getMemberRhFields(teamId: string): Promise<Map<string, MemberRhFields>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('team_members')
    .select('user_id, role_key, role_keys, department_key, manager_user_id, joined_at, status')
    .eq('team_id', teamId)
  if (error) throw error
  const map = new Map<string, MemberRhFields>()
  for (const row of (data ?? []) as MemberRhFields[]) map.set(row.user_id, row)
  return map
}
