'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIMARY_MODULES, visibleNavModules } from '@/lib/navigation'
import { useModuleAccess } from '@/components/auth/ModuleAccessProvider'

/**
 * Barra de navegação inferior — SÓ mobile (<1024px). Renderizada pelo DashboardShell.
 * Deriva da FONTE ÚNICA (@/lib/navigation): mostra os módulos `primary` (Minha Mesa › Hall › Comercial) + um
 * botão "Mais" que abre o menu lateral (Sidebar drawer) com TODOS os módulos — nada escondido no celular.
 * (Clientes deixou de ser andar — vive em Administração › Clientes, CLIENT-HISTORY-ADMIN-003.)
 * Um módulo novo marcado `primary` aparece aqui automaticamente; o resto vai no "Mais".
 */
const itemCls = 'flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 outline-none focus-visible:ring-2 focus-visible:ring-lime/50 rounded-md [-webkit-tap-highlight-color:transparent]'

export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname()
  // "Sem acesso → nem aparece" também no acesso rápido. Sem provider = mostra tudo (fail-open). O botão
  // "Mais" abre o mesmo drawer (Sidebar), já filtrado — nada de módulo sem acesso aparece.
  const ma = useModuleAccess()
  const primary = ma ? visibleNavModules(PRIMARY_MODULES, ma.access, ma.canManageTeam) : PRIMARY_MODULES
  return (
    <nav className="lg:hidden shrink-0 border-t border-bento-border bg-bento-panel pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] [-webkit-tap-highlight-color:transparent]">
      <div className="flex items-stretch">
        {primary.map(({ href, label, shortLabel, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              onClick={e => e.currentTarget.blur()}
              className={cn(itemCls, active ? 'text-lime-fg' : 'text-bento-muted')}
            >
              <Icon className={cn('w-5 h-5', active && 'drop-shadow-[0_0_6px_rgba(194,247,58,0.4)]')} />
              <span className="font-tech text-[10px] tracking-tight whitespace-nowrap leading-none">{shortLabel ?? label}</span>
            </Link>
          )
        })}
        {/* "Mais" — abre o menu lateral (Sidebar) com TODOS os módulos. Nada escondido no celular. */}
        <button type="button" onClick={onMore} aria-label="Mais módulos" className={cn(itemCls, 'text-bento-muted')}>
          <Menu className="w-5 h-5" />
          <span className="font-tech text-[10px] tracking-tight whitespace-nowrap leading-none">Mais</span>
        </button>
      </div>
    </nav>
  )
}
