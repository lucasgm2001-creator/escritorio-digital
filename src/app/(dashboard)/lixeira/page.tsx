import { redirect } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { LixeiraClient } from './LixeiraClient'

// Lixeira (F4) — clientes/leads excluídos (soft delete). Restaurar / excluir definitivo. OWNER-ONLY: o gate
// real são os RPCs (list_deleted_* / restore_* / hard_delete_*, todos owner-only) + a UI (useRole) esconde de
// não-owner. Vive no grupo (dashboard) → herda o DashboardShell (rail global + topbar), sem casca nova.
export default async function LixeiraPage() {
  const context = await getRequestContext()
  if (!context) redirect('/login')
  return <LixeiraClient />
}
