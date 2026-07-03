import { Presentation, Search } from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'
import { TrafficEmptyState } from '@/components/traffic/TrafficEmptyState'

const KPIS = ['Campanhas', 'Ativas', 'Investimento', 'Conversões']
const FILTERS = ['Cliente', 'Plataforma', 'Status', 'Objetivo', 'Responsável']

export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Campanhas" subtitle="Campanhas de todas as plataformas — status, objetivo, investimento e resultados." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {KPIS.map(kpi => <MetricCard key={kpi} title={kpi} value="—" size="sm" />)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(filter => (
          <span key={filter} className="text-[12px] text-bento-muted border border-bento-border rounded-btn px-3 py-1.5">{filter}</span>
        ))}
        <div className="flex items-center gap-2 bento-fx px-3 py-1.5 ml-auto">
          <Search className="w-3.5 h-3.5 text-bento-dim" />
          <span className="text-[12px] text-bento-dim">Buscar campanha…</span>
        </div>
      </div>

      <TrafficEmptyState icon={Presentation} title="Nenhuma campanha disponível" hint="Conecte uma plataforma em Contas para trazer campanhas, conjuntos e anúncios." />
    </div>
  )
}
