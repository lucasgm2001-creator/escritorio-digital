import type { LucideIcon } from 'lucide-react'

// Estado vazio PROFISSIONAL: nunca uma tela morta — explica o que virá e por quê.
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  hint,
}: {
  icon: LucideIcon
  title: string
  description: string
  hint?: string
}) {
  return (
    <div className="rounded-frame border border-dashed border-bento-border bg-bento-panel/30 p-6 sm:p-8 flex flex-col items-center text-center gap-2">
      <div className="w-11 h-11 rounded-bento bg-bento-panel/60 border border-bento-border flex items-center justify-center">
        <Icon className="w-5 h-5 text-bento-dim" />
      </div>
      <p className="font-semibold text-sm text-bento-text">{title}</p>
      <p className="text-[12px] text-bento-muted max-w-sm leading-relaxed">{description}</p>
      {hint && <p className="text-[11px] text-bento-dim mt-1">{hint}</p>}
    </div>
  )
}
