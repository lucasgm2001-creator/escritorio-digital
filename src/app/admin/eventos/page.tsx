import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { getPublishedEvents } from '@/server/services/AdminOverviewService'
import { EventCenter } from '@/components/events/EventCenter'

// Administração › Eventos (ADMIN-REAL-001): eventos publicados REAIS (feed activities) + catálogo de tipos.
export default async function Page() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  const published = context ? await getPublishedEvents(context, 12) : { total: 0, recent: [] }
  return <EventCenter published={published} />
}
