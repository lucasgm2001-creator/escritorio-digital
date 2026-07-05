import 'server-only'

import { redirect } from 'next/navigation'
import { canAccessAdmin } from '@/lib/permissions/admin-access'
import type { RequestContext } from '@/server/context/request-context'

// Guarda de ENTRADA de módulo (PERMISSIONS-002): "Sem acesso → nem entra". O nível efetivo já vem resolvido
// no servidor (context.moduleAccess — papel → override → efetivo). Nível 'none' redireciona para o Hall (home
// sempre acessível). É a porta de entrada da ROTA; não substitui as guardas de AÇÃO (requirePermission/can)
// nem a RLS — é a primeira barreira, no servidor, antes de qualquer UI carregar.
export function requireModuleEntry(context: RequestContext, moduleKey: string): void {
  const level = context.moduleAccess[moduleKey] ?? 'none'
  if (level === 'none') redirect('/hall')
}

// Guarda das seções de GESTÃO da Administração (CLIENT-HISTORY-ADMIN-003). O /admin/layout passou a admitir
// também quem tem o módulo 'clientes' (para chegar em Administração → Clientes), então cada seção de gestão
// (Empresa, Equipe, Colaboradores, Remuneração...) precisa barrar quem NÃO é owner/dev — senão um membro
// operacional acessaria governança por URL direta. Não-admin cai em /admin/clientes (a única seção que ele vê).
// A seção 'clientes' NUNCA chama isto: ela é gated por requireModuleEntry('clientes').
export function requireAdminManage(context: RequestContext): void {
  if (!canAccessAdmin(context)) redirect('/admin/clientes')
}
