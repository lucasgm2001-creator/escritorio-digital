import { InboundCenter } from '@/components/inbound/InboundCenter'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'

// Administração › Webhooks de Entrada (INBOUND-001). Estado VISUAL apenas — nada conecta/recebe/grava.
export default async function Page() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  return <InboundCenter />
}
