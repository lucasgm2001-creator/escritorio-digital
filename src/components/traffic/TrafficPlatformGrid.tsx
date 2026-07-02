// Preparação VISUAL das fontes de mídia (Meta/Google/TikTok/LinkedIn + Analytics + tracking).
// Monogramas (sem ícones de marca) + chip "off" = não conectado. Zero integração/API. Reutilizável
// (dashboard de Tráfego e, no futuro, aba Tráfego do cliente — mesmos componentes).

type Platform = { name: string; monogram: string; category: 'Ads' | 'Analytics' | 'Tracking' }

const PLATFORMS: Platform[] = [
  { name: 'Meta Ads', monogram: 'M', category: 'Ads' },
  { name: 'Google Ads', monogram: 'G', category: 'Ads' },
  { name: 'TikTok Ads', monogram: 'TT', category: 'Ads' },
  { name: 'LinkedIn Ads', monogram: 'in', category: 'Ads' },
  { name: 'Analytics (GA4)', monogram: 'GA', category: 'Analytics' },
  { name: 'Search Console', monogram: 'SC', category: 'Analytics' },
  { name: 'Meta Pixel', monogram: 'PX', category: 'Tracking' },
  { name: 'Conversions API', monogram: 'API', category: 'Tracking' },
]

export function TrafficPlatformGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {PLATFORMS.map(platform => (
        <div key={platform.name} className="bento-fx p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-bento bg-bento-panel border border-bento-border flex items-center justify-center shrink-0">
            <span className="font-tech text-[11px] font-bold text-bento-muted">{platform.monogram}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-bento-text truncate">{platform.name}</p>
            <p className="text-[10px] text-bento-dim">{platform.category}</p>
          </div>
          <span className="text-[9px] font-tech uppercase text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">off</span>
        </div>
      ))}
    </div>
  )
}
