import { Briefcase } from 'lucide-react'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'
import { TrafficEmptyState } from '@/components/traffic/TrafficEmptyState'

export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Anúncios" subtitle="Anúncios individuais — criativo, status e resultado por anúncio." />
      <TrafficEmptyState icon={Briefcase} title="Nenhum anúncio disponível" hint="Os anúncios aparecem quando os conjuntos forem sincronizados de uma plataforma conectada." />
    </div>
  )
}
