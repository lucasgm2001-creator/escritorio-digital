import type { ModuleLevel, PermissionAction } from './types'

// Vocabulário e semântica dos NÍVEIS de acesso por módulo (PERMISSIONS-002). Camada base, pura, sem
// dependência de domínio — o can() (autoridade) e a UI leem daqui. Autoridade única do "o que cada nível
// pode fazer": nunca duplicar essa regra em componentes.

export const MODULE_LEVELS: ModuleLevel[] = ['none', 'read', 'edit', 'admin']

export const MODULE_LEVEL_LABEL: Record<ModuleLevel, string> = {
  none: 'Sem acesso', read: 'Somente leitura', edit: 'Editar', admin: 'Administrador',
}

// Mapeia NÍVEL → ações permitidas (reconcilia o modelo de níveis com o vocabulário de ações do catálogo):
//   none  → nada
//   read  → apenas ver
//   edit  → ver / criar / editar (altera dados normalmente)
//   admin → tudo do módulo (inclui excluir / gerenciar / aprovar / exportar)
// Ações "fortes" (delete/manage/approve/export) exigem admin — leitura e edição não as concedem.
export function levelAllows(level: ModuleLevel, action: PermissionAction): boolean {
  switch (level) {
    case 'admin':
      return true
    case 'edit':
      return action === 'view' || action === 'create' || action === 'edit'
    case 'read':
      return action === 'view'
    case 'none':
    default:
      return false
  }
}
