import { cn } from '@/lib/utils'

export type MetricSize = 'big' | 'md' | 'sm'

// Número em Space Grotesk com tracking negativo (painel_padrao_tecnico.html).
// big=46px (herói), md=30px, sm=22px.
const SIZE_CLS: Record<MetricSize, string> = {
  big: 'text-[46px] tracking-[-0.03em]',
  md:  'text-[30px] tracking-[-0.02em]',
  sm:  'text-[22px] tracking-[-0.02em]',
}

interface MetricProps {
  size?: MetricSize
  /** Parte secundária menor e apagada (ex: centavos "40", sufixo). */
  cents?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function Metric({ size = 'md', cents, className, children }: MetricProps) {
  return (
    <span
      className={cn(
        'font-display font-bold leading-none tabular-nums text-bento-text',
        SIZE_CLS[size],
        className,
      )}
    >
      {children}
      {cents != null && (
        <span className="font-medium" style={{ fontSize: '0.52em', color: '#6b7280' }}>{cents}</span>
      )}
    </span>
  )
}
