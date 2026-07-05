// Domínio de Pessoas (PEOPLE-001) — modelo oficial: Departamento → Cargo → Template → Colaborador.
// Tipos PUROS (sem 'server-only'): compartilhados entre a camada de dados (server) e a UI.
// Multi-tenant por padrão (TEAM-001): toda entidade pertence a uma equipe (teamId).
// Preparado para COMPENSATION-001 / PERMISSION-001 / AUTOMATION-001 sem retrabalho.

import type { ModuleAccessRow } from './module-access'

export type CollaboratorStatus = 'ativo' | 'inativo' | 'convidado' | 'afastado'

// Departamento — a área da empresa. Topo da estrutura de pessoas.
export type Department = {
  id: string
  teamId: string
  name: string
  description: string | null
}

// Cargo — a FUNÇÃO profissional. NÃO é permissão e NÃO é remuneração (fronteiras da Constituição).
export type Role = {
  id: string
  teamId: string
  departmentId: string | null
  name: string
  description: string | null
  isCustom: boolean
  // Sugestão de template. A remuneração REAL virá do template atribuído ao colaborador (COMPENSATION-001).
  suggestedTemplateId: string | null
}

// Template — a "casca" que no futuro carregará remuneração, metas, benefícios, regras, automações e
// indicadores. NADA disso é implementado agora — apenas a estrutura para plugar COMPENSATION-001.
export type CompensationTemplate = {
  id: string
  teamId: string
  name: string
  roleId: string | null
}

// PEOPLE-002: o tipo `Collaborator` (entidade fictícia do seed) foi REMOVIDO. O colaborador REAL é um
// membro da equipe (team_members + profiles), projetado direto nos view-models abaixo. `CollaboratorStatus`
// segue vivo (usado pelos VMs e pela apresentação). A forma persistida de RH será definida pela migration
// real quando os campos (cargo/depto/gestor/template) forem ao banco — não por um tipo especulativo.

// ---- View-models (compostos no Service; a UI recebe pronto, sem fazer joins) ----

export type PeopleOverview = {
  departments: number
  roles: number
  templates: number
  collaborators: number
}

export type DepartmentSummary = Department & {
  roleCount: number
  collaboratorCount: number
}

export type RoleSummary = Role & {
  departmentName: string | null
  collaboratorCount: number
  suggestedTemplateName: string | null
}

// Papel de ACESSO real na equipe (TEAM-001) — vem de team_members. Distinto de cargo/função (roleName).
export type TeamAccessRole = 'owner' | 'admin' | 'member'

// Linha da matriz efetiva de acesso por módulo (PEOPLE-002, Parts 5/6) — reexport do modelo puro para a UI.
export type { ModuleAccessRow }

export type CollaboratorCardVM = {
  id: string                 // = userId (colaborador real = membro da equipe)
  userId: string
  name: string
  email: string | null
  avatarUrl: string | null
  teamRole: TeamAccessRole   // owner/admin/member (real)
  joinedAt: string | null    // entrada na equipe (real)
  status: CollaboratorStatus
  departmentName: string | null   // ainda não configurado no RH → honesto
  roleName: string | null         // cargo PRIMÁRIO (= role_keys[0]) — compat/exibição curta
  roleKeys: string[]              // TODOS os cargos (multi) — fonte única team_members.role_keys (ACCESS-ROLES-001)
  roleNames: string[]             // nomes resolvidos dos cargos (catálogo) para pills
  templateName: string | null
  managerName: string | null
}

// Detalhe do colaborador (Master → Detail). Resolve tudo o que a tela de detalhe mostra.
export type CollaboratorDetailVM = {
  id: string
  userId: string
  name: string
  email: string | null
  avatarUrl: string | null
  teamRole: TeamAccessRole
  joinedAt: string | null
  status: CollaboratorStatus
  departmentName: string | null
  roleName: string | null
  roleKeys: string[]
  roleNames: string[]
  roleDescription: string | null
  templateName: string | null
  managerName: string | null
  moduleMatrix: ModuleAccessRow[]   // acesso efetivo por módulo, resolvido no servidor (Parts 5/6)
}
