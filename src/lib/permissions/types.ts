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

export type PermissionContext = {
  role: PermissionRole | null | undefined
  permissions?: Partial<Record<PermissionModule, PermissionAction[]>>
}
