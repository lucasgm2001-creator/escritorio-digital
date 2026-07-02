import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// MetricCard — primitiva de KPI do Design System (DS-006).
// DS-005: invisivel. Superficie bento neutra, sem glow/animacao decorativa; o acento (lime) so
// aparece quando o dado e positivo/enfatico (tone). Serve Hall, Comercial, Financeiro, Clientes, Vendedores.
// Layout puro: quem posiciona (grid/linha) e a tela; aqui e so 1 card. Nao migra call-sites.

export type MetricTone = 'default' | 'positive' | 'negative' | 'muted' | 'emerald' | 'blue' | 'lime'
export type MetricSize = 'sm' | 'md' | 'lg'

export type MetricTrend = {
  /** variacao numerica; o sinal define a cor (>=0 positivo, <0 negativo) */
  value: number
  /** sufixo do numero, ex.: '%' */
  suffix?: string
  /** legenda curta ao lado, ex.: 'vs mes ant.' */
  label?: string
}

export interface MetricCardProps {
  title: string
  value: ReactNode
  subtitle?: string
  icon?: ReactNode
  trend?: MetricTrend
  tone?: MetricTone
  size?: MetricSize
  /** navegacao (Link do Next) — torna o card inteiro tocavel */
  href?: string
  /** acao (botao) — torna o card inteiro tocavel */
  onClick?: () => void
  className?: string
}

const TONE_VALUE: Record<MetricTone, string> = {
  default: 'text-bento-text',
  positive: 'text-lime-fg',
  negative: 'text-red-400',
  muted: 'text-bento-muted',
  emerald: 'text-emerald-400',
  blue: 'text-blue-400',
  lime: 'text-lime-fg',
}

// Escala de tamanho. md = tamanho ATUAL (Hall) — nao mudar para nao quebrar o uso existente.
const SIZE_CARD: Record<MetricSize, string> = { sm: 'px-3 py-2', md: 'px-3 py-2.5', lg: 'px-4 py-4' }
const SIZE_TITLE: Record<MetricSize, string> = { sm: 'text-[10px]', md: 'text-[11px]', lg: 'text-xs' }
const SIZE_VALUE: Record<MetricSize, string> = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }

export function MetricCard({
  title, value, subtitle, icon, trend, tone = 'default', size = 'md', href, onClick, className,
}: MetricCardProps) {
  const interactive = !!href || !!onClick

  // Superficie base (bento). Interativo: alvo confortavel (min-h-[64px] cobre >44px), foco visivel e
  // realce SUTIL de borda no hover — sem scale/glow/animacao decorativa (DS-005).
  const cardCls = cn(
    'bento-fx flex flex-col gap-1 text-left w-full', SIZE_CARD[size],
    interactive && 'min-h-[64px] transition-colors hover:border-lime/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40',
    className,
  )

  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className={cn('font-tech uppercase tracking-wide text-bento-muted truncate flex-1 min-w-0', SIZE_TITLE[size])}>{title}</span>
        {icon && <span className="text-bento-muted shrink-0 [&_svg]:w-4 [&_svg]:h-4">{icon}</span>}
      </div>

      <span className={cn('font-display font-bold tabular-nums leading-none', SIZE_VALUE[size], TONE_VALUE[tone])}>{value}</span>

      {(subtitle || trend) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {trend && (
            <span className={cn('font-tech text-[11px] tabular-nums', trend.value >= 0 ? 'text-lime-fg' : 'text-red-400')}>
              {trend.value >= 0 ? '+' : ''}{trend.value}{trend.suffix ?? ''}
            </span>
          )}
          {trend?.label && <span className="text-[11px] text-bento-muted">{trend.label}</span>}
          {subtitle && <span className="text-[11px] text-bento-muted truncate">{subtitle}</span>}
        </div>
      )}
    </>
  )

  if (href) {
    return <Link href={href} className={cardCls}>{body}</Link>
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={cardCls}>{body}</button>
  }
  return <div className={cardCls}>{body}</div>
}
