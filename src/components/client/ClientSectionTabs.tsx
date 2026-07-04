'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { DomainConfig } from '@/lib/domain/nav'

// Seções do cliente como ABAS HORIZONTAIS (desktop e mobile) — o 2º e ÚLTIMO nível de navegação (o 1º é o rail
// global do DashboardShell). Substitui o rail VERTICAL do DomainShell no Workspace do Cliente. Sticky p/ ficar
// sempre acessível; rola na horizontal quando não cabe (celular/iPad). Ativo pelo pathname exato do segmento.
export function ClientSectionTabs({ config }: { config: DomainConfig }) {
  const pathname = usePathname()
  return (
    <div className="sticky top-0 z-20 border-b border-bento-border bg-bento-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bento-bg/80 shrink-0">
      <div className="mx-auto w-full max-w-6xl px-2 md:px-4 lg:px-6">
        <nav className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Seções do cliente">
          {config.sections.map(section => {
            const Icon = section.icon
            const active = pathname === section.href
            return (
              <Link
                key={section.key}
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 min-h-[44px] border-b-2 -mb-px text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors [-webkit-tap-highlight-color:transparent]',
                  active ? 'border-lime text-lime-fg' : 'border-transparent text-bento-muted hover:text-bento-text',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {section.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
