// Fundação do PERMISSION ENGINE (Constituição, Título 8). ADITIVO ao lib/permissions/can.ts existente —
// NÃO altera can.ts, RLS nem banco. Formaliza os conceitos para a matriz por módulo (PERMISSION-001):
// quem VÊ / CONFIGURA / APROVA / CONSULTA, por recurso e escopo. A proteção do dado será RLS (futuro).

export type RoleName = 'owner' | 'admin' | 'manager' | 'member' | 'guest'

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'approve' | 'export'

export type Resource =
  | 'company' | 'team' | 'people' | 'compensation' | 'permissions'
  | 'commercial' | 'clients' | 'finance' | 'reports'
  | 'integrations' | 'api' | 'billing' | 'audit'

export type Capability = `${Resource}:${Action}`

// Escopo da permissão (multi-tenant). workspaceId reservado para o futuro SaaS; hoje o tenant é a equipe.
export type PermissionScope = { workspaceId: string | null; teamId: string }

// Policy: capacidades de um papel. PolicyEvaluator: resolve se um papel pode agir sobre um recurso no escopo.
export type Policy = {
  role: RoleName
  capabilities: Capability[]
}

export interface PolicyEvaluator {
  can(role: RoleName, resource: Resource, action: Action, scope: PermissionScope): boolean
}
