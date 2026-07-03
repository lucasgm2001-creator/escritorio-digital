import { FolderOpen } from 'lucide-react'
import { TrafficHeader } from '@/components/traffic/TrafficHeader'
import { TrafficEmptyState } from '@/components/traffic/TrafficEmptyState'

const TABS = ['Imagens', 'Vídeos', 'Copies', 'Headlines', 'CTAs', 'Tags']

export default function Page() {
  return (
    <div className="space-y-6">
      <TrafficHeader eyebrow="Tráfego" title="Criativos" subtitle="Biblioteca de criativos — imagens, vídeos, copies e performance." />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(tab => (
          <span key={tab} className="text-[12px] text-bento-muted border border-bento-border rounded-btn px-3 py-1.5">{tab}</span>
        ))}
      </div>

      <TrafficEmptyState icon={FolderOpen} title="Biblioteca vazia" hint="Conecte uma plataforma para importar criativos, ou traga imagens, vídeos e copies quando o upload estiver disponível." />
    </div>
  )
}
