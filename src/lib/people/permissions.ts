import 'server-only'

import { can } from '@/lib/permissions/can'
import { PERMISSION_CATALOG } from '@/lib/permissions/catalog'
import type { PermissionModule, PermissionAction } from '@/lib/permissions/types'
import type { TeamRoleDefault } from './catalog'

// Resolução de PERMISSÕES por cargo (PEOPLE-001, Part 7). Modelo: cargo → permissões padrão → overrides
// individuais → permissões EFETIVAS. Tudo PURO e calculado NO SERVIDOR ('server-only'); a UI recebe o
// resultado pronto (nada de recomputar no client). NÃO duplica o sistema de permissões — deriva do can()
// existente (fonte única) e do catálogo oficial. Sem persistência: os overrides são um contrato (a UI/action
// os fornece; onde salvar fica para PERMISSION-001 com autorização de migration).

export type PermissionKey = `${PermissionModule}.${PermissionAction}`

// Override individual: concede/revoga permissões específicas sobre o padrão do cargo.
export type PermissionOverride = {
  grant: PermissionKey[]
  revoke: PermissionKey[]
}

export const EMPTY_OVERRIDE: PermissionOverride = { grant: [], revoke: [] }

// PADRÃO do cargo: derivado do papel de acesso (owner/admin/member) — NÃO mantém uma 2ª lista de permissões.
// Enumera o catálogo oficial e pergunta ao can() (fonte única da verdade) o que aquele papel pode.
export function defaultPermissionsFor(teamRole: TeamRoleDefault): PermissionKey[] {
  const out: PermissionKey[] = []
  for (const [moduleKey, actions] of Object.entries(PERMISSION_CATALOG)) {
    const mod = moduleKey as PermissionModule
    for (const action of actions as readonly PermissionAction[]) {
      if (can({ role: teamRole }, mod, action)) out.push(`${mod}.${action}`)
    }
  }
  return out
}

// EFETIVAS = padrão do cargo + grants − revokes. É o que vale de fato para o colaborador.
export function effectivePermissions(teamRole: TeamRoleDefault, override: PermissionOverride = EMPTY_OVERRIDE): PermissionKey[] {
  const set = new Set<PermissionKey>(defaultPermissionsFor(teamRole))
  for (const g of override.grant) set.add(g)
  for (const r of override.revoke) set.delete(r)
  return Array.from(set).sort()
}

export function hasEffectivePermission(
  teamRole: TeamRoleDefault, key: PermissionKey, override?: PermissionOverride,
): boolean {
  return effectivePermissions(teamRole, override).includes(key)
}
