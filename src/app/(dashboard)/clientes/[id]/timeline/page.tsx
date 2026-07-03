import { getRequestContext } from '@/server/context/request-context'
import { getClientTimeline } from '@/server/services/ClientTimelineService'
import { Panel } from '@/components/bento/Panel'
import { LeadTimeline } from '@/components/lead/LeadTimeline'

// Timeline do Cliente — dados REAIS via ClientTimelineService (ARCH-001, TEAM-001). Reusa o LeadTimeline
// (mesmo padrão visual do Lead Hub). O acesso à equipe já é garantido pelo layout do workspace.
export default async function ClientTimelinePage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const items = context ? await getClientTimeline(context, params.id) : []

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">Timeline</h1>
        <p className="text-sm text-bento-muted">História do cliente — criação, recebimentos e atividades reais. Mesma timeline do Lead Hub.</p>
      </header>
      <Panel label="Histórico"><LeadTimeline items={items} /></Panel>
    </div>
  )
}
