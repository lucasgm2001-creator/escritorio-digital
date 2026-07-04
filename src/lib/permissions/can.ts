import { isKnownPermission } from './catalog'
import { levelAllows } from './levels'
import type { PermissionAction, PermissionContext, PermissionModule } from './types'

// Função pura de autorização (autoridade de acesso — PERMISSIONS-002). A verdade é context.moduleLevels:
// níveis EFETIVOS por módulo resolvidos NO SERVIDOR (papel → padrão → override → efetivo). Quando presente
// para o módulo, ele DECIDE. As listas por papel abaixo são só FALLBACK LEGADO — para módulos ainda fora da
// matriz (calendar/studio/notifications) e contextos sem níveis resolvidos (ex.: derivação de padrões).

const MEMBER_PERMISSIONS: Partial<Record<PermissionModule, PermissionAction[]>> = {
  hall: ['view'],
  commercial: ['view', 'create', 'edit'],
  clients: ['view', 'create', 'edit'],
  traffic: ['view'],
  calendar: ['view', 'create', 'edit', 'delete'],
  studio: ['view', 'create', 'edit'],
  reports: ['view'],
  notifications: ['view'],
}

const ADMIN_PERMISSIONS: Partial<Record<PermissionModule, PermissionAction[]>> = {
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
}

function hasPermission(
  permissions: Partial<Record<PermissionModule, PermissionAction[]>> | undefined,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  return permissions?.[module]?.includes(action) ?? false
}

export function can(
  context: PermissionContext,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  if (!isKnownPermission(module, action)) return false

  // AUTORIDADE: nível efetivo resolvido no servidor decide (papel/override já aplicados). Nunca vem da UI —
  // só o getRequestContext popula moduleLevels. Presente ⇒ é a palavra final para este módulo.
  const level = context.moduleLevels?.[module]
  if (level !== undefined) return levelAllows(level, action)

  // FALLBACK LEGADO (módulo fora da matriz ou contexto sem resolução): grants explícitos + regra por papel.
  if (hasPermission(context.permissions, module, action)) return true

  switch (context.role) {
    case 'owner':
      return true
    case 'admin':
      return hasPermission(ADMIN_PERMISSIONS, module, action)
    case 'member':
      return hasPermission(MEMBER_PERMISSIONS, module, action)
    case 'guest':
    default:
      return false
  }
}
