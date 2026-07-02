import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getLeadHub } from '@/server/services/LeadHubService'
import { LeadHub } from '@/components/lead/LeadHub'

// Hub do Lead (Master → Detail). Escopado por equipe no LeadHubService (lead de outra equipe → notFound).
export default async function LeadHubPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const vm = context ? await getLeadHub(context, params.id) : null
  if (!vm) notFound()

  return <LeadHub vm={vm} embedded />
}
