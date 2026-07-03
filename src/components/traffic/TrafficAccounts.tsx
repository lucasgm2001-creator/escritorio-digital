import { Clock } from 'lucide-react'
import { TrafficHeader } from './TrafficHeader'

// Workspace de CONTAS (TRAFFIC-002). Cada plataforma: monograma, categoria, descrição, status, última
// sincronização, contas e ação Conectar (inerte — sem integração real). Reutilizável (global e cliente).
type Platform = { name: string; monogram: string; category: string; description: string }

const PLATFORMS: Platform[] = [
  { name: 'Meta Ads', monogram: 'M', category: 'Ads', description: 'Campanhas, conjuntos e anúncios da Meta (Facebook e Instagram).' },
  { name: 'Google Ads', monogram: 'G', category: 'Ads', description: 'Search, Performance Max, Display e YouTube.' },
  { name: 'Google Analytics 4', monogram: 'GA', category: 'Analytics', description: 'Usuários, sessões, eventos e origens de tráfego.' },
  { name: 'Search Console', monogram: 'SC', category: 'Analytics', description: 'Consultas, cliques, impressões e posição no Google.' },
  { name: 'TikTok Ads', monogram: 'TT', category: 'Ads', description: 'Campanhas e criativos de vídeo do TikTok.' },
  { name: 'LinkedIn Ads', monogram: 'in', category: 'Ads', description: 'Campanhas B2B segmentadas por cargo e empresa.' },
  { name: 'Meta Pixel', monogram: 'PX', category: 'Tracking', description: 'Eventos de navegação e conversão no site.' },
  { name: 'Conversions API', monogram: 'API', category: 'Tracking', description: 'Eventos server-side (CAPI) para atribuição resiliente.' },
]

export function TrafficAccounts({ scopeLabel }: { scopeLabel?: string }) {
  return (
    <div className="space-y-6">
      <TrafficHeader
        eyebrow={scopeLabel ? `Tráfego · ${scopeLabel}` : 'Tráfego'}
        title="Contas"
        subtitle="Sem contas conectadas. Conecte uma plataforma para começar a trazer campanhas, conversões e analytics."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {PLATFORMS.map(platform => (
          <div key={platform.name} className="bento-fx p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-bento bg-bento-panel border border-bento-border flex items-center justify-center shrink-0">
                <span className="font-tech text-[12px] font-bold text-bento-muted">{platform.monogram}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-bento-text truncate">{platform.name}</p>
                <p className="text-[10px] text-bento-dim">{platform.category}</p>
              </div>
              <span className="text-[9px] font-tech uppercase tracking-wide text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">desconectado</span>
            </div>
            <p className="text-[12px] text-bento-muted leading-relaxed min-h-[2.5rem]">{platform.description}</p>
            <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-bento-border/60">
              <span className="text-[10px] text-bento-dim inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Nunca sincronizado · 0 contas</span>
              <button type="button" disabled className="text-[12px] font-semibold text-bento-dim border border-bento-border rounded-btn px-2.5 py-1 min-h-[36px] opacity-70 cursor-not-allowed">Conectar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
