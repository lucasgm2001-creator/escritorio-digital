import 'server-only'

import { redirect } from 'next/navigation'
import type { RequestContext } from '@/server/context/request-context'

// Guarda de ENTRADA de módulo (PERMISSIONS-002): "Sem acesso → nem entra". O nível efetivo já vem resolvido
// no servidor (context.moduleAccess — papel → override → efetivo). Nível 'none' redireciona para o Hall (home
// sempre acessível). É a porta de entrada da ROTA; não substitui as guardas de AÇÃO (requirePermission/can)
// nem a RLS — é a primeira barreira, no servidor, antes de qualquer UI carregar.
export function requireModuleEntry(context: RequestContext, moduleKey: string): void {
  const level = context.moduleAccess[moduleKey] ?? 'none'
  if (level === 'none') redirect('/hall')
}
