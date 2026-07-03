import { Files } from 'lucide-react'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'
import { TrafficEmptyState } from '@/components/traffic/TrafficEmptyState'

export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Conjuntos" subtitle="Conjuntos de anúncios — segmentação, orçamento e entrega." />
      <TrafficEmptyState icon={Files} title="Nenhum conjunto disponível" hint="Os conjuntos aparecem quando as campanhas forem sincronizadas de uma plataforma conectada." />
    </div>
  )
}
