import type { LucideIcon } from 'lucide-react'

// Tile de informação reutilizável (ícone + rótulo + valor). Base das telas de detalhe de Pessoas.
export function InfoTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="bento-fx p-3.5 flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-bento bg-bento-panel/60 border border-bento-border flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-bento-dim" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-bento-muted">{label}</p>
        <p className="text-sm text-bento-text truncate mt-0.5">{value}</p>
      </div>
    </div>
  )
}
