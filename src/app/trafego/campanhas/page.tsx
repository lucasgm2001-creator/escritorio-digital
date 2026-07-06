import { Presentation } from 'lucide-react'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'
import { TrafficEmptyState } from '@/components/traffic/TrafficEmptyState'

// Sem integração conectada, a tela não mostra KPIs "—" nem filtros mortos (UX-TRAFFIC-ENTERPRISE-001):
// um único estado premium com o próximo passo. Filtros/KPIs voltam quando houver campanha real.
export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Campanhas" subtitle="Campanhas de todas as plataformas — status, objetivo, investimento e resultados." />
      <TrafficEmptyState
        icon={Presentation}
        title="Nenhuma campanha ainda"
        hint="Conecte uma conta de anúncio para trazer campanhas, conjuntos e anúncios — com status, investimento e resultados por campanha."
      />
    </div>
  )
}
