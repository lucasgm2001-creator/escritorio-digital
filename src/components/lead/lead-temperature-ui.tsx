import { CircleDot, Flame, Snowflake, type LucideIcon } from 'lucide-react'
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
