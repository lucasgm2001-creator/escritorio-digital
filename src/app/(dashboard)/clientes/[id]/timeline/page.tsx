import { Panel } from '@/components/bento/Panel'
import { LeadTimeline } from '@/components/lead/LeadTimeline'

// Timeline do Cliente — REUSA a timeline universal do Lead Hub (mesmo componente). Sem dados nesta fase.
export default function ClientTimelinePage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">Timeline</h1>
        <p className="text-sm text-bento-muted">A mesma timeline universal do Lead Hub, adaptada ao cliente.</p>
      </header>
      <Panel label="Histórico"><LeadTimeline items={[]} /></Panel>
    </div>
  )
}
