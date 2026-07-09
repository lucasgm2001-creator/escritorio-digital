import { CircleDot, Flame, Snowflake, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { LeadTemperature } from '@/lib/commercial/lead-hub-types'

type TemperatureMeta = {
  label: string
  icon: LucideIcon
  className: string
}

const TEMPERATURE_META: Record<LeadTemperature, TemperatureMeta> = {
  quente: {
    label: 'Quente',
    icon: Flame,
    className: 'border-red-500/25 bg-red-500/10 text-red-300 [html.light_&]:text-red-700',
  },
  morno: {
    label: 'Morno',
    icon: CircleDot,
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-300 [html.light_&]:text-amber-700',
  },
  frio: {
    label: 'Frio',
    icon: Snowflake,
    className: 'border-sky-500/25 bg-sky-500/10 text-sky-300 [html.light_&]:text-sky-700',
  },
}

export function ActionIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon
  className?: string
}) {
  return (
    <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-btn border border-bento-border bg-bento-panel/50 text-bento-dim', className)}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  )
}

export function ResultIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon
  className?: string
}) {
  return (
    <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-bento border', className)}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  )
}

export function HealthIndicator({
  className,
}: {
  className?: string
}) {
  return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', className)} aria-hidden />
}

export function LeadStatusBadge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex max-w-full items-center rounded-full border border-lime/30 bg-lime/10 px-2 py-0.5 text-[10px] font-tech uppercase tracking-wide text-lime-fg', className)}>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  )
}

export function LeadTemperatureBadge({
  temperature,
  className,
}: {
  temperature: LeadTemperature
  className?: string
}) {
  const meta = TEMPERATURE_META[temperature]
  const Icon = meta.icon

  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold', meta.className, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{meta.label}</span>
    </span>
  )
}
