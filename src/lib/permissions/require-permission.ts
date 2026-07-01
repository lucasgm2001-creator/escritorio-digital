import { can } from './can'
import type { PermissionAction, PermissionContext, PermissionModule } from './types'

export class PermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED'
  readonly module: PermissionModule
  readonly action: PermissionAction
  readonly role: PermissionContext['role']

  constructor(
    context: PermissionContext,
    module: PermissionModule,
    action: PermissionAction,
  ) {
    super(`Permission denied for ${module}.${action}`)
    this.name = 'PermissionDeniedError'
    this.module = module
    this.action = action
    this.role = context.role
  }
}

// Helper de enforcement para Services/Server Actions futuros. Ele nao redireciona
// nem altera UI; apenas centraliza a falha de permissao em um erro controlado.
export function requirePermission<TContext extends PermissionContext>(
  context: TContext,
  module: PermissionModule,
  action: PermissionAction,
): TContext {
  if (!can(context, module, action)) {
    throw new PermissionDeniedError(context, module, action)
  }

  return context
}
