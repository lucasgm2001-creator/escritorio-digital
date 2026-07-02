'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DOMAIN_CONFIGS } from '@/lib/domain/registry'
import type { DomainKey } from '@/lib/domain/nav'

// Rail/lista de seções GENÉRICA (rail no desktop/iPad, conteúdo do bottom sheet no mobile).
export function DomainNav({ configKey, subtitle, className, hideHeader, onNavigate }: {
  configKey: DomainKey
  subtitle?: string | null
  className?: string
  hideHeader?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const config = DOMAIN_CONFIGS[configKey]

  return (
    <nav className={cn('flex-col bg-bento-bg', className)}>
      {!hideHeader && (
        <div className="h-14 px-4 flex flex-col justify-center border-b border-bento-border shrink-0">
          <Link href={config.backHref} className="inline-flex w-fit items-center gap-1 text-[11px] text-bento-muted hover:text-bento-text transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> {config.backLabel}
          </Link>
          <span className="font-display font-semibold text-sm text-bento-text mt-0.5 leading-none">{config.title}</span>
          {subtitle && <span className="font-tech text-[10px] text-bento-muted truncate mt-0.5">{subtitle}</span>}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-4">
        {config.groups.map(group => {
          const items = config.sections.filter(section => section.group === group.key)
          if (items.length === 0) return null
          return (
            <div key={group.key} className="space-y-0.5">
              <p className="px-2.5 pb-1 font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">{group.label}</p>
              {items.map(section => {
                const Icon = section.icon
                const active = pathname === section.href
                return (
                  <Link
                    key={section.key}
                    href={section.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 rounded-btn text-sm min-h-[44px] transition-colors',
                      active ? 'bg-lime/15 text-lime-fg font-medium' : 'text-bento-dim hover:text-bento-text hover:bg-bento-panel/50',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{section.label}</span>
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-lime shrink-0" />}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
