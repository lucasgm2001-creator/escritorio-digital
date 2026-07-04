// Tipos centrais do Permission Engine. Nesta fase eles ainda nao alteram
// comportamento; servem como contrato para Request Context, Services e UI futura.

export type Guest = 'guest'
export type Member = 'member'
export type Admin = 'admin'
export type Owner = 'owner'

export type PermissionRole = Guest | Member | Admin | Owner

export type PermissionModule =
  | 'hall'
  | 'commercial'
  | 'clients'
  | 'finance'
  | 'traffic'
  | 'calendar'
  | 'studio'
  | 'settings'
  | 'teams'
  | 'users'
  | 'reports'
  | 'notifications'

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'manage'
  | 'approve'
  | 'export'

export type Permission = {
  module: PermissionModule
  action: PermissionAction
}

// Nível de acesso por módulo (autoridade da matriz — PERMISSIONS-002). Vocabulário único: sem acesso →
// leitura → editar → administrador. Definido aqui (camada base, sem dependências) para o can() e o domínio
// Pessoas consumirem sem ciclo de import.
export type ModuleLevel = 'none' | 'read' | 'edit' | 'admin'

export type PermissionContext = {
  role: PermissionRole | null | undefined
  permissions?: Partial<Record<PermissionModule, PermissionAction[]>>
  // Níveis EFETIVOS por módulo já resolvidos NO SERVIDOR (papel → padrão → override individual → efetivo).
  // Quando presente para um módulo, é a AUTORIDADE: decide o acesso. Ausente → fallback por papel (legado,
  // para módulos ainda fora da matriz e contextos sem resolução).
  moduleLevels?: Partial<Record<PermissionModule, ModuleLevel>>
}
