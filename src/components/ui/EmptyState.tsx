import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// Estado vazio ÚNICO (EXPERIENCE-001): ícone + título + descrição + ação. Nunca "em breve"/"placeholder";
// sempre estado real de produto ("Sem contas conectadas", "Nenhuma campanha disponível").
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="bento-fx flex flex-col items-center justify-center text-center gap-3 px-6 py-14">
      <div className="w-12 h-12 rounded-bento bg-bento-panel border border-bento-border flex items-center justify-center">
        <Icon className="w-6 h-6 text-bento-dim" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-bento-text">{title}</p>
        {description && <p className="text-[13px] text-bento-muted max-w-sm mx-auto leading-relaxed">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
