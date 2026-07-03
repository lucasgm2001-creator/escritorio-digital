import type { LucideIcon } from 'lucide-react'

// Estado vazio ELEGANTE (TRAFFIC-002). Nada de "em breve"/"placeholder" — estados reais de produto
// ("Sem contas conectadas", "Nenhuma campanha disponível"). Reutilizável em todo o domínio.
export function TrafficEmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="bento-fx flex flex-col items-center justify-center text-center gap-3 px-6 py-14">
      <div className="w-12 h-12 rounded-bento bg-bento-panel border border-bento-border flex items-center justify-center">
        <Icon className="w-6 h-6 text-bento-dim" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-bento-text">{title}</p>
        {hint && <p className="text-[13px] text-bento-muted max-w-sm mx-auto leading-relaxed">{hint}</p>}
      </div>
    </div>
  )
}
