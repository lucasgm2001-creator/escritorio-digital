'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/brand/BrandMark'
import { MAIN_MODULES, SYSTEM_MODULES, visibleNavModules, type NavModule } from '@/lib/navigation'
import { useModuleAccess } from '@/components/auth/ModuleAccessProvider'

interface SidebarProps {
  open: boolean
  onToggle: () => void
  mobileClose?: () => void
  /** nome da equipe ativa (multi-workspace) — 2ª linha da marca. null/vazio = esconde a linha. */
  activeTeamName?: string | null
}

export function Sidebar({ open, onToggle, mobileClose, activeTeamName }: SidebarProps) {
  const pathname = usePathname()
  const isMobileDrawer = !!mobileClose

  // Filtra pela AUTORIDADE de acesso (PERMISSIONS-002): "Sem acesso → nem aparece". Sem provider = mostra
  // tudo (fail-open; a proteção real é a guarda de rota no servidor). Itens seguem da FONTE ÚNICA.
  const ma = useModuleAccess()
  const mainModules = ma ? visibleNavModules(MAIN_MODULES, ma.access, ma.canManageTeam) : MAIN_MODULES
  const systemModules = ma ? visibleNavModules(SYSTEM_MODULES, ma.access, ma.canManageTeam) : SYSTEM_MODULES
  return (
    <aside
      className={cn(
        'flex flex-col h-dvh transition-[width] duration-200 ease-in-out shrink-0 relative z-30',
        'bg-sidebar border-r border-sidebar-border/10',
        isMobileDrawer ? 'w-56' : open ? 'w-56' : 'w-[60px]'
      )}
    >
      {/* Marca do app — símbolo oficial "O Módulo Ativo" + wordmark "Escritório Digital".
          Expandida = símbolo + nome; recolhida (rail estreito) = só o símbolo, centralizado. */}
      <div className="flex items-center min-h-[56px] px-3 pt-[env(safe-area-inset-top)] border-b border-sidebar-border/10 overflow-hidden gap-2.5">
        <BrandMark
          size={30}
          decorative={open || isMobileDrawer}
          className={cn('shrink-0', !(open || isMobileDrawer) && 'mx-auto')}
        />
        {(open || isMobileDrawer) && (
          <div className="min-w-0 flex flex-col justify-center leading-tight">
            <span className="font-display font-bold text-sidebar-foreground text-[15px] tracking-tight truncate">
              Escritório Digital
            </span>
            {/* 2ª linha: equipe ativa (multi-workspace). Esconde se null/vazio — nunca mostra "Workspace". */}
            {activeTeamName && (
              <span className="font-tech text-[11px] text-sidebar-muted truncate">{activeTeamName}</span>
            )}
          </div>
        )}
        {isMobileDrawer && (
          <button onClick={mobileClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-sidebar-accent/10 transition-colors text-sidebar-muted hover:text-sidebar-foreground"
            aria-label="Fechar menu">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-hidden overflow-y-auto">
        {mainModules.map(item => (
          <NavLink key={item.href} item={item} pathname={pathname} open={open || isMobileDrawer} />
        ))}

        {systemModules.length > 0 && (
          <>
            {(open || isMobileDrawer) && (
              <div className="px-2 pt-4 pb-1">
                <p className="text-[10px] uppercase tracking-wider text-sidebar-muted font-semibold">Sistema</p>
              </div>
            )}
            {!(open || isMobileDrawer) && <div className="my-2 mx-2 border-t border-sidebar-border/10" />}
            {systemModules.map(item => (
              <NavLink key={item.href} item={item} pathname={pathname} open={open || isMobileDrawer} />
            ))}
          </>
        )}
      </nav>

      {/* Toggle (only on desktop) */}
      {!isMobileDrawer && (
        <button
          onClick={onToggle}
          className="m-2 p-2 rounded-lg hover:bg-sidebar-accent/10 transition-colors text-sidebar-muted hover:text-sidebar-foreground flex items-center justify-center"
          aria-label={open ? 'Fechar sidebar' : 'Abrir sidebar'}
        >
          <svg
            className={cn('w-4 h-4 transition-transform duration-200', open ? 'rotate-180' : '')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </aside>
  )
}

function NavLink({ item, pathname, open }: { item: NavModule; pathname: string; open: boolean }) {
  const active = pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <div className="relative group">
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-sm min-h-[44px] md:min-h-0',
          active
            ? 'bg-lime/15 text-lime-fg font-medium'
            : 'text-slate-400 hover:bg-[rgba(255,255,255,0.05)] hover:text-slate-200'
        )}
      >
        <span className={cn('shrink-0', active ? 'text-lime-fg' : '')}>
          <item.Icon className="w-[18px] h-[18px] shrink-0" />
        </span>
        {open && (
          <span className="whitespace-nowrap truncate">{item.label}</span>
        )}
        {active && open && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
        )}
      </Link>

      {/* Tooltip when collapsed */}
      {!open && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1.5 bg-[#1e2533] border border-[#2d3748] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-card">
          {item.label}
        </div>
      )}
    </div>
  )
}
