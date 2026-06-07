import { cn } from '@/lib/utils'

interface LiveDotProps {
  /** 'accent' (padrão) = bolinha verde-limão. 'ink' = bolinha escura p/ usar sobre fundo no acento. */
  tone?: 'accent' | 'ink'
  className?: string
}

// Indicador "vivo/online": pulso sutil de opacidade (sem glow forte).
export function LiveDot({ tone = 'accent', className }: LiveDotProps) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full animate-live shrink-0',
        tone === 'accent' ? 'bg-lime' : 'bg-lime-ink',
        className,
      )}
      aria-hidden
    />
  )
}
