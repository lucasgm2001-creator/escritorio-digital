import { cn } from '@/lib/utils'

type Variant = 'primary' | 'ghost'

// primary: verde-limão + texto escuro (#0A0C10). ghost: transparente + borda.
const VARIANT_CLS: Record<Variant, string> = {
  primary: 'bg-lime text-lime-ink hover:bg-lime-dim',
  ghost:   'bg-transparent border border-bento-border text-bento-text hover:border-lime',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

// Botão do design system. Radius 10px, alvo de toque mínimo 44px.
export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-btn px-4 min-h-[44px]',
        'text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLS[variant],
        className,
      )}
      {...props}
    />
  )
}
