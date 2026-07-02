import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// IconButton — botao so-icone do Design System (DS-012). Compativel com Button (mesma paleta de
// variantes, foco, raio). DS-005: discreto, sem glow/animacao decorativa. Alvo de toque 44px por
// padrao (size='md') — corrige os ~23 icone-botoes p-1/p-1.5 (<44px) do modulo. Nao migra nada.
// aria-label e OBRIGATORIO: icone sem rotulo e inacessivel.

type IconButtonVariant = 'ghost' | 'outline' | 'solid' | 'destructive'
type IconButtonSize = 'md' | 'sm'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode
  'aria-label': string
  variant?: IconButtonVariant
  size?: IconButtonSize
  loading?: boolean
}

const BASE =
  'inline-flex items-center justify-center rounded-btn shrink-0 ' +
  'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40'

// Alinhado ao Button: ghost (padrao), outline (=secondary), solid (=primary/.bento-btn), destructive.
const VARIANT: Record<IconButtonVariant, string> = {
  ghost: 'text-bento-muted hover:text-bento-text hover:bg-bento-bg transition-colors',
  outline: 'border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors',
  solid: 'bento-btn',
  destructive: 'text-bento-muted hover:text-red-400 hover:bg-red-500/10 transition-colors',
}

// md = 44px (alvo de toque). sm = 36px, so contextos densos/desktop.
const SIZE: Record<IconButtonSize, string> = {
  md: 'w-11 h-11 [&_svg]:w-5 [&_svg]:h-5',
  sm: 'w-9 h-9 [&_svg]:w-4 [&_svg]:h-4',
}

// Spinner inline (temporario ate DS-016 <Spinner>): cor corrente, sutil (DS-005).
function InlineSpinner() {
  return <span aria-hidden className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, variant = 'ghost', size = 'md', loading = false, className, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(BASE, VARIANT[variant], SIZE[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <InlineSpinner /> : icon}
    </button>
  )
})
