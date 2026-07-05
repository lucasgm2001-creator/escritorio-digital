'use server'

import { revalidatePath } from 'next/cache'
import { getRequestContext } from '@/server/context/request-context'
import { canAccessAdmin } from '@/lib/permissions/admin-access'
import { createServiceClient } from '@/lib/supabase/service'
import { roleByKey } from '@/lib/people/catalog'
import { eventBus, createDomainEvent } from '@/lib/events/runtime'

// Mutação do domínio Pessoas (ARCH-001): UI → Server Action → team_members (migration 044). PEOPLE-002A.
// Altera o CARGO/DEPARTAMENTO de um colaborador. Autoridade = servidor: owner/admin (can teams.manage) +
// guarda de ownership (o alvo tem que ser membro da equipe ATIVA; service-role ignora RLS). Nada client-direct.
// NÃO toca remuneração/comissão/RLS/TeamService.

type ActionResult = { ok: true } | { ok: false; error: string }

// Altera os CARGOS (múltiplos) de um colaborador. Autoridade = OWNER ou DESENVOLVEDOR (canAccessAdmin) —
// não mais qualquer 'admin' (ACCESS-ROLES-001). Fonte única: team_members.role_keys (+ role_key = primário
// p/ compat, + department_key derivado do primário). Só chaves VÁLIDAS do catálogo, sem duplicar.
export async function updateCollaboratorRolesAction(input: {
  userId: string
  roleKeys: string[]
}): Promise<ActionResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!canAccessAdmin(context)) return { ok: false, error: 'Apenas Owner ou Desenvolvedor podem alterar cargos.' }
  const teamId = context.activeTeamId
  if (!teamId) return { ok: false, error: 'Sem equipe ativa.' }

  // Só chaves VÁLIDAS do catálogo, sem duplicar, preservando a ordem (primeiro = primário).
  const seen = new Set<string>()
  const roleKeys: string[] = []
  for (const k of input.roleKeys) {
    if (k && !seen.has(k) && roleByKey(k)) { seen.add(k); roleKeys.push(k) }
  }
  const primary = roleKeys[0] ?? null
  const departmentKey = primary ? (roleByKey(primary)?.department ?? null) : null

  const svc = createServiceClient()
  // Guarda de ownership: o alvo TEM que ser membro da equipe ativa (service-role ignora RLS).
  const { data: membership } = await svc.from('team_members')
    .select('id').eq('team_id', teamId).eq('user_id', input.userId).maybeSingle()
  if (!membership) return { ok: false, error: 'Colaborador não pertence à sua equipe.' }

  const { error } = await svc.from('team_members')
    .update({ role_keys: roleKeys, role_key: primary, department_key: departmentKey })
    .eq('team_id', teamId).eq('user_id', input.userId)
  if (error) return { ok: false, error: error.message }

  // Event Bus (best-effort — contratos prontos; nunca quebra a ação).
  try {
    const ctx = { teamId, userId: context.user.id, requestId: null }
    await eventBus.publish(createDomainEvent('employee.role.changed', 'people',
      { collaboratorId: input.userId, roleKeys }, ctx, { source: 'Colaboradores' }))
    if (departmentKey) {
      await eventBus.publish(createDomainEvent('employee.department.changed', 'people',
        { collaboratorId: input.userId, departmentKey }, ctx, { source: 'Colaboradores' }))
    }
  } catch { /* barramento em memória — não bloqueia a mutação */ }

  revalidatePath(`/admin/colaboradores/${input.userId}`)
  revalidatePath('/admin/colaboradores')
  return { ok: true }
}
