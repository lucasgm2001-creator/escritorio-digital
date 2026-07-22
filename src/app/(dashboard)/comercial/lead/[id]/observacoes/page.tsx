import { notFound } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { getLeadHub } from '@/server/services/LeadHubService'
import { getLeadObservations } from '@/server/services/ObservationService'
import { LeadProfileTabs } from '@/components/lead/LeadProfileTabs'
import { ObservationWorkspace } from '@/components/observations/ObservationWorkspace'
import { LeadStatusBadge } from '@/components/lead/lead-profile-primitives'

export default async function LeadObservationsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const context = await getRequestContext()
  if (!context) notFound()
  const [lead, items] = await Promise.all([getLeadHub(context, id), getLeadObservations(context, id)])
  if (!lead) notFound()

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3 flex-wrap">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime/20 bg-lime/10 text-lime-fg">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="break-words font-display text-xl font-bold text-bento-text">{lead.name}</h1>
            {lead.stageName && <LeadStatusBadge>{lead.stageName}</LeadStatusBadge>}
          </div>
          <p className="mt-1 text-sm text-bento-muted">Evolução permanente das observações · {items.length} registro(s)</p>
        </div>
      </header>
      <LeadProfileTabs leadId={id} active="observations" />
      <ObservationWorkspace entityType="lead" entityId={id} items={items} />
    </div>
  )
}
