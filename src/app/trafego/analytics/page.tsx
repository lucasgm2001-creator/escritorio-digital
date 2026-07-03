import { MetricCard } from '@/components/ui/MetricCard'
import { Panel } from '@/components/bento/Panel'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'

const KPIS = ['Usuários', 'Sessões', 'Eventos', 'Engajamento']
const PANELS = ['Origens', 'Dispositivos', 'Países', 'Cidades', 'Landing pages']

export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Analytics" subtitle="Audiência e comportamento (GA4) — usuários, sessões, origens e páginas." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {KPIS.map(kpi => <MetricCard key={kpi} title={kpi} value="—" size="sm" />)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {PANELS.map(panel => (
          <Panel key={panel} label={panel}>
            <p className="text-[13px] text-bento-muted">Conecte o GA4 para ver {panel.toLowerCase()}.</p>
          </Panel>
        ))}
      </div>
    </div>
  )
}
