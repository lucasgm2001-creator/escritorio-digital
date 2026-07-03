import { getRequestContext } from '@/server/context/request-context'
import { getClientTimeline } from '@/server/services/ClientTimelineService'
import { Panel } from '@/components/bento/Panel'
import { LeadTimeline } from '@/components/lead/LeadTimeline'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

// Timeline do Cliente — dados REAIS via ClientTimelineService (ARCH-001, TEAM-001). Reusa o LeadTimeline
// (mesmo padrão visual do Lead Hub). O acesso à equipe já é garantido pelo layout do workspace.
export default async function ClientTimelinePage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const items = context ? await getClientTimeline(context, params.id) : []

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title="Timeline"
        subtitle="História do cliente — criação, recebimentos e atividades reais. Mesma timeline do Lead Hub."
        size="compact"
      />
      <Panel label="Histórico"><LeadTimeline items={items} /></Panel>
    </div>
  )
}
