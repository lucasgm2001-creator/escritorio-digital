'use server'

import { revalidatePath } from 'next/cache'
import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createServiceClient } from '@/lib/supabase/service'
import { roleByKey, departmentByKey, type DepartmentKey } from '@/lib/people/catalog'
import { eventBus, createDomainEvent } from '@/lib/events/runtime'

// Mutação do domínio Pessoas (ARCH-001): UI → Server Action → team_members (migration 044). PEOPLE-002A.
// Altera o CARGO/DEPARTAMENTO de um colaborador. Autoridade = servidor: owner/admin (can teams.manage) +
// guarda de ownership (o alvo tem que ser membro da equipe ATIVA; service-role ignora RLS). Nada client-direct.
// NÃO toca remuneração/comissão/RLS/TeamService.

type ActionResult = { ok: true } | { ok: false; error: string }

export async function updateCollaboratorRoleAction(input: {
  userId: string
  roleKey: string | null
  departmentKey?: string | null
}): Promise<ActionResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!can(context, 'teams', 'manage')) return { ok: false, error: 'Apenas owner/admin podem alterar o cargo.' }
  const teamId = context.activeTeamId
  if (!teamId) return { ok: false, error: 'Sem equipe ativa.' }

  // Cargo: null (limpar) OU uma chave VÁLIDA do catálogo oficial (nada fora do catálogo).
  const role = input.roleKey ? roleByKey(input.roleKey) : null
  if (input.roleKey && !role) return { ok: false, error: 'Cargo inválido.' }

  // Departamento: informado (se válido) OU derivado do cargo (Part 5). Sem cargo → limpa.
  let departmentKey: string | null = null
  if (input.departmentKey) {
    if (!departmentByKey(input.departmentKey as DepartmentKey)) return { ok: false, error: 'Departamento inválido.' }
    departmentKey = input.departmentKey
  } else if (role) {
    departmentKey = role.department
  }

  const svc = createServiceClient()
  // Guarda de ownership: o alvo TEM que ser membro da equipe ativa.
  const { data: membership } = await svc.from('team_members')
    .select('id').eq('team_id', teamId).eq('user_id', input.userId).maybeSingle()
  if (!membership) return { ok: false, error: 'Colaborador não pertence à sua equipe.' }

  const { error } = await svc.from('team_members')
    .update({ role_key: input.roleKey, department_key: departmentKey })
    .eq('team_id', teamId).eq('user_id', input.userId)
  if (error) return { ok: false, error: error.message }

  // Event Bus (Part 7): reusa o barramento existente (best-effort — contratos prontos; nunca quebra a ação).
  try {
    const ctx = { teamId, userId: context.user.id, requestId: null }
    await eventBus.publish(createDomainEvent('employee.role.changed', 'people',
      { collaboratorId: input.userId, roleKey: input.roleKey }, ctx, { source: 'Colaboradores' }))
    if (departmentKey) {
      await eventBus.publish(createDomainEvent('employee.department.changed', 'people',
        { collaboratorId: input.userId, departmentKey }, ctx, { source: 'Colaboradores' }))
    }
  } catch { /* barramento em memória — não bloqueia a mutação */ }

  revalidatePath(`/admin/colaboradores/${input.userId}`)
  revalidatePath('/admin/colaboradores')
  return { ok: true }
}
