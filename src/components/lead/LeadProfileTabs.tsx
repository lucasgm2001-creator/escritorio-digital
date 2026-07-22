import Link from 'next/link'
import { ClipboardList, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LeadProfileTabs({ leadId, active }: { leadId: string; active: 'overview' | 'observations' }) {
  const tabs = [
    { key: 'overview' as const, label: 'Visão geral', href: `/comercial/lead/${leadId}`, icon: LayoutDashboard },
    { key: 'observations' as const, label: 'Observações', href: `/comercial/lead/${leadId}/observacoes`, icon: ClipboardList },
  ]
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-bento-border" aria-label="Seções do lead">
      {tabs.map(tab => {
        const Icon = tab.icon
        return (
          <Link key={tab.key} href={tab.href} aria-current={active === tab.key ? 'page' : undefined}
            className={cn('inline-flex min-h-[42px] shrink-0 items-center gap-1.5 border-b-2 px-3 text-[13px] font-medium transition-colors',
              active === tab.key ? 'border-lime text-lime-fg' : 'border-transparent text-bento-muted hover:text-bento-text')}>
            <Icon className="h-4 w-4" /> {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
