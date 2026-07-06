import { Crosshair } from 'lucide-react'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'
import { TrafficEmptyState } from '@/components/traffic/TrafficEmptyState'

// Sem pixel conectado, um único estado premium (não 6 eventos "—" soltos).
export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Conversões" subtitle="Pixel e eventos de conversão — padrão e customizados." />
      <TrafficEmptyState
        icon={Crosshair}
        title="Nenhum pixel conectado"
        hint="Conecte o Meta Pixel e a Conversions API para medir conversões, eventos padrão e eventos customizados."
      />
    </div>
  )
}
