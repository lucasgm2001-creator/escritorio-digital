'use server'

import { revalidatePath } from 'next/cache'
import { getRequestContext } from '@/server/context/request-context'
import { setMemberModuleLevel, type ModulePermDeny } from '@/server/services/TeamService'
import type { ModuleLevel } from '@/lib/permissions/types'

// Server Action do EDITOR de permissões (PERMISSIONS-002). É só um CLIENTE da arquitetura: valida a sessão e
// delega ao serviço (autoridade no servidor). Nunca confia na UI — o serviço revalida owner/equipe/alvo.
type Result = { ok: true } | { ok: false; error: string }

const DENY_MESSAGE: Record<ModulePermDeny, string> = {
  'no-active-team':   'Selecione uma equipe ativa.',
  'not-authorized':   'Apenas o dono da equipe pode alterar permissões.',
  'target-not-found': 'Colaborador não encontrado nesta equipe.',
  'target-is-self':   'O dono da equipe já tem acesso total.',
  'target-not-member':'Owner e administrador têm acesso total — não é personalizável.',
  'invalid-module':   'Módulo inválido.',
  'invalid-level':    'Nível de acesso inválido.',
}

export async function setMemberModuleLevelAction(
  targetUserId: string,
  moduleKey: string,
  level: ModuleLevel,
): Promise<Result> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }

  const outcome = await setMemberModuleLevel(context, targetUserId, moduleKey, level)
  if (!outcome.ok) return { ok: false, error: DENY_MESSAGE[outcome.reason] }

  // Recompõe a matriz efetiva na próxima renderização do perfil (a autoridade recalcula no servidor).
  revalidatePath(`/admin/colaboradores/${targetUserId}`)
  return { ok: true }
}
