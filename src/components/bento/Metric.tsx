import { cn } from '@/lib/utils'

export type MetricSize = 'big' | 'md' | 'sm'

// Número grande em Space Grotesk. big=38px, md=30px, sm=22px.
const SIZE_CLS: Record<MetricSize, string> = {
  big: 'text-[38px]',
  md:  'text-[30px]',
  sm:  'text-[22px]',
}

interface MetricProps {
  size?: MetricSize
  className?: string
  children: React.ReactNode
}

export function Metric({ size = 'md', className, children }: MetricProps) {
  return (
    <span
      className={cn(
        'font-display font-bold leading-none tabular-nums text-bento-text',
        SIZE_CLS[size],
        className,
      )}
    >
      {children}
    </span>
  )
}
