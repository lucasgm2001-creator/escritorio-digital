import { TrafficPlatformGrid } from '@/components/traffic/TrafficPlatformGrid'

// Tráfego do Cliente — REUSA a grade de plataformas do módulo Tráfego + módulos em roadmap. Sem integração.
const MODULES = ['Contas de anúncio', 'Campanhas', 'Criativos', 'Conversões', 'Analytics', 'Dashboards']

export default function ClientTrafegoPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">Tráfego · em roadmap</p>
        <h1 className="font-display font-bold text-xl text-bento-text">Mídia paga do cliente</h1>
        <p className="text-sm text-bento-muted">Reusa o módulo Tráfego, filtrado por este cliente. Sem integração nesta fase.</p>
      </header>

      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Plataformas</p>
        <TrafficPlatformGrid />
      </div>

      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Módulos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {MODULES.map(module => (
            <div key={module} className="bento-fx p-3 flex items-center justify-between gap-2">
              <span className="text-[13px] text-bento-text truncate">{module}</span>
              <span className="text-[9px] font-tech uppercase text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">em breve</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
