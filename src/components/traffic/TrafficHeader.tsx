// Cabeçalho padrão das telas de Tráfego (reutilizável — global e dentro do cliente).
export function TrafficHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <header className="space-y-1">
      {eyebrow && <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">{eyebrow}</p>}
      <h1 className="font-display font-bold text-2xl text-bento-text">{title}</h1>
      {subtitle && <p className="text-sm text-bento-muted max-w-prose">{subtitle}</p>}
    </header>
  )
}
