import { getRequestContext } from '@/server/context/request-context'
import { listLeadsForMaster } from '@/server/services/LeadHubService'
import { CommercialMasterDetail } from '@/components/lead/CommercialMasterDetail'

// Layout Master → Detail: a lista (master) vive aqui e PERSISTE entre leads; só o detalhe ([id]) troca.
export default async function LeadMasterDetailLayout({ children }: { children: React.ReactNode }) {
  const context = await getRequestContext()
  const leads = context ? await listLeadsForMaster(context) : []

  return <CommercialMasterDetail leads={leads}>{children}</CommercialMasterDetail>
}
