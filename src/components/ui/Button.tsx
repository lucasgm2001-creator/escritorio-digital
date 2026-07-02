import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

// Button — primitiva de acao do Design System (DS-011). API do DS-007.
// DS-005: discreto (sem glow exagerado; o primary reusa a classe .bento-btn ja existente).
// Alvo de toque 44px por padrao (size='md'); 'sm' so para contextos densos/desktop.
// Cobre os ~59 call-sites de .bento-btn do modulo (primary/secondary/destructive/ghost). Nao migra nada.

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'
type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  /** renderiza o filho (ex.: <Link>) aplicando o estilo do botao (via Slot) */
  asChild?: boolean
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-btn font-semibold ' +
  'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40'

// primary = classe .bento-btn (cor/hover/active/sombra/transicao ja definidos em globals.css).
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bento-btn',
  secondary: 'border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors',
  destructive: 'bg-red-500/90 text-white hover:bg-red-500 transition-colors',
  ghost: 'text-bento-muted hover:text-bento-text hover:bg-bento-bg transition-colors',
}

const SIZE: Record<ButtonSize, string> = {
  md: 'min-h-[44px] px-4 py-2.5 text-sm',
  sm: 'min-h-[36px] px-3 py-1.5 text-xs',
}

// Spinner inline (temporario ate DS-016 <Spinner>): usa a cor corrente, sutil (DS-005).
function InlineSpinner() {
  return <span aria-hidden className="w-4 h-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin" />
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, fullWidth = false,
    asChild = false, className, disabled, children, ...props },
  ref,
) {
  const cls = cn(BASE, VARIANT[variant], SIZE[size], fullWidth && 'w-full', className)

  // asChild: aplica o estilo ao filho (ex.: Link). Composicao de icone/loading fica com o chamador.
  if (asChild) {
    return <Slot ref={ref} className={cls} {...props}>{children}</Slot>
  }

  return (
    <button ref={ref} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <InlineSpinner /> : leftIcon && <span className="shrink-0 [&_svg]:w-4 [&_svg]:h-4">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="shrink-0 [&_svg]:w-4 [&_svg]:h-4">{rightIcon}</span>}
    </button>
  )
})
