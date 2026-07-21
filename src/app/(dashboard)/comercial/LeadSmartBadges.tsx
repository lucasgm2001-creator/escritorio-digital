'use client'

import { cn } from '@/lib/utils'
import { smartLeadBadges, type LeadSmartBadgeTone } from './leadSignals'
import type { Lead } from './types'

const BADGE_TONE: Record<LeadSmartBadgeTone, string> = {
  danger: 'border-red-400/30 bg-red-400/[0.12] text-red-400',
  warning: 'border-amber-400/30 bg-amber-400/[0.12] text-amber-400',
  hot: 'border-lime/30 bg-lime/15 text-lime-fg',
  success: 'border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-400',
  info: 'border-blue-400/30 bg-blue-400/[0.12] text-blue-400',
  muted: 'border-bento-border bg-bento-bg text-bento-muted',
}

export function LeadSmartBadges({ lead, max = 3, className }: { lead: Lead; max?: number; className?: string }) {
  const badges = smartLeadBadges(lead, max)
  if (badges.length === 0) return null

  return (
    <div className={cn('flex min-w-0 max-w-full flex-wrap items-center gap-1', className)}>
      {badges.map(badge => (
        <span
          key={badge.key}
          title={badge.title}
          className={cn(
            'inline-flex min-h-4 max-w-full shrink-0 items-center rounded border px-1.5 py-0.5 font-tech text-[10px] font-semibold leading-none whitespace-nowrap',
            BADGE_TONE[badge.tone],
          )}
        >
          <span>{badge.label}</span>
        </span>
      ))}
    </div>
  )
}
