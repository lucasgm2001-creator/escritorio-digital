import type { LucideIcon } from 'lucide-react'

// Cabeçalho das telas de Pessoas/Administração. Sem back-link: a navegação vem do cabeçalho da
// Administração (rail no desktop, bottom sheet no mobile).
export function PeopleHeader({
  icon: Icon,
  title,
  tagline,
  badge,
  stats,
}: {
  icon: LucideIcon
  title: string
  tagline: string
  badge?: string
  stats?: { label: string; value: number | string }[]
}) {
  return (
    <div className="space-y-4">
      <header className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-bento bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-lime-fg" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl text-bento-text">{title}</h1>
            {badge && (
              <span className="text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border border-bento-border text-bento-dim">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-bento-muted mt-1">{tagline}</p>
        </div>
      </header>

      {stats && stats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.map(stat => (
            <span key={stat.label} className="inline-flex items-baseline gap-1.5 rounded-btn border border-bento-border px-2.5 py-1.5">
              <span className="font-display font-bold text-sm text-bento-text">{stat.value}</span>
              <span className="text-[11px] text-bento-muted">{stat.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
