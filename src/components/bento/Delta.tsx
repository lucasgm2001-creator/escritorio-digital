import { cn } from '@/lib/utils'

interface DeltaProps {
  /** Variação percentual. Positivo → acento (▲); negativo → vermelho suave (▼). */
  value: number
  suffix?: string
  className?: string
}

// Positivo no acento (verde-limão) conforme o design system. Negativo num
// vermelho dessaturado para não competir com o acento nem virar alarme.
export function Delta({ value, suffix = '%', className }: DeltaProps) {
  const up = value >= 0
  return (
    <span
      className={cn(
        'font-tech text-xs font-semibold inline-flex items-center gap-0.5 tabular-nums',
        up ? 'text-lime-fg' : 'text-[#E5687A]',
        className,
      )}
    >
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      {Math.abs(value)}{suffix}
    </span>
  )
}
