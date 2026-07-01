import type { PermissionAction, PermissionModule } from './types'

// Catalogo inicial de permissoes por modulo. Ele e deliberadamente pequeno:
// adicionamos novas acoes conforme houver uma regra de negocio real para elas.

export const PERMISSION_CATALOG = {
  hall: ['view'],
  commercial: ['view', 'create', 'edit', 'delete', 'manage', 'export'],
  clients: ['view', 'create', 'edit', 'delete', 'export'],
  finance: ['view', 'edit', 'approve', 'export'],
  traffic: ['view', 'create', 'edit', 'delete', 'export'],
  calendar: ['view', 'create', 'edit', 'delete'],
  studio: ['view', 'create', 'edit', 'delete', 'manage'],
  settings: ['view', 'manage'],
  teams: ['view', 'create', 'edit', 'manage'],
  users: ['view', 'create', 'edit', 'delete', 'manage'],
  reports: ['view', 'export'],
  notifications: ['view', 'create', 'edit', 'delete', 'manage'],
} as const satisfies Record<PermissionModule, readonly PermissionAction[]>

export function isKnownPermission(
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  return (PERMISSION_CATALOG[module] as readonly PermissionAction[]).includes(action)
}
