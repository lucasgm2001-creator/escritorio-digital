'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadTimelineItem } from '@/lib/commercial/lead-hub-types'

function hasLongDescription(description: string): boolean {
  const lines = description.split(/\r?\n/).length
  return lines > 4 || description.length > 260
}

export function LeadTimelineDescription({ item }: { item: LeadTimelineItem }) {
  const description = item.description
  const [expanded, setExpanded] = useState(false)
  if (!description) return null

  const isLong = hasLongDescription(description)
  const contentId = `timeline-description-${item.id}`
  const ToggleIcon = expanded ? ChevronUp : ChevronDown

  return (
    <div className="mt-1.5">
      <div
        id={contentId}
        className={cn(
          'relative overflow-hidden transition-[max-height] duration-300 ease-out',
          isLong && !expanded ? 'max-h-24' : 'max-h-[999rem]',
        )}
      >
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-bento-muted break-words">
          {description}
        </p>
        {isLong && !expanded && (
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-bento-panel to-transparent"
            aria-hidden
          />
        )}
      </div>

      {isLong && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(current => !current)}
          className="mt-2 inline-flex min-h-[34px] items-center gap-1.5 rounded-btn border border-bento-border bg-bento-panel/50 px-2.5 py-1.5 text-[12px] font-semibold text-bento-text transition-colors hover:border-lime/35 hover:bg-lime/10 hover:text-lime-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40"
        >
          <ToggleIcon className="h-3.5 w-3.5" aria-hidden />
          {expanded ? 'Mostrar menos' : 'Ver transcrição completa'}
        </button>
      )}
    </div>
  )
}
