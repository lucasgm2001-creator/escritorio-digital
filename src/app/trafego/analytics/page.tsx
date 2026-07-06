import { BarChart3 } from 'lucide-react'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'
import { TrafficEmptyState } from '@/components/traffic/TrafficEmptyState'

// Sem GA4 conectado, um único estado premium (não 4 KPIs "—" + 5 painéis repetindo "Conecte o GA4").
export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Analytics" subtitle="Audiência e comportamento (GA4) — usuários, sessões, origens e páginas." />
      <TrafficEmptyState
        icon={BarChart3}
        title="Analytics ainda não conectado"
        hint="Conecte o GA4 para ver usuários, sessões, origens, dispositivos e páginas de destino num só lugar."
      />
    </div>
  )
}
