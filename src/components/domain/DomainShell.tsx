'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, ChevronLeft, X } from 'lucide-react'
import { DomainNav } from './DomainNav'
import { Sidebar } from '@/components/layout/Sidebar'
import { WorkspaceSwitcher, type SwitcherTeam } from '@/components/layout/WorkspaceSwitcher'
import { DOMAIN_CONFIGS } from '@/lib/domain/registry'
import type { DomainConfig, DomainKey } from '@/lib/domain/nav'

// Casca GENÉRICA de domínio (Administração, Tráfego, Workspace do Cliente, ...). Uma implementação p/ todos.
// Mobile: cabeçalho fixo (← back / seção / Seções) + bottom sheet. iPad/Desktop: rail + contexto.
// Aceita configKey (registro estático) OU um config resolvido (ex.: Cliente, com hrefs por id).
export function DomainShell({ configKey, config: configProp, visibleSectionKeys, subtitle, userName, role, userEmail = null, avatarUrl = null, teams = [], children }: {
  configKey?: DomainKey
  config?: DomainConfig
  visibleSectionKeys?: string[]   // filtro de seções por permissão (só as CHAVES — serializável server→client)
  subtitle: string | null
  userName: string
  role: string
  userEmail?: string | null
  avatarUrl?: string | null
  teams?: SwitcherTeam[]
  children: React.ReactNode
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const pathname = usePathname()
  const resolved = configProp ?? DOMAIN_CONFIGS[configKey!]
  // Filtro de seções por PERMISSÃO (HOTFIX-ADMIN-001): recebe só as CHAVES (serializável) e resolve/filtra AQUI, no
  // client — os ícones (lucide, funções) nunca cruzam a fronteira server→client. Passar o config PRONTO com ícones
  // quebrava /admin ("Functions cannot be passed directly to Client Components", digest 4189986675).
  const config = visibleSectionKeys && visibleSectionKeys.length
    ? { ...resolved, sections: resolved.sections.filter(s => visibleSectionKeys.includes(s.key)) }
    : resolved
  const current = config.sections.find(section =>
    pathname === section.href || (section.href !== config.homePath && pathname.startsWith(section.href + '/')),
  )
  const sectionName = current?.label ?? config.title

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bento-bg text-bento-text">
      {/* Rail GLOBAL persistente (IPAD-003) — a MESMA Sidebar/NAV_MODULES do DashboardShell, nunca some.
          Em Tráfego/Administração dá pra trocar de módulo SEM voltar ao Hall. Só md+ (iPad/desktop); no
          celular a navegação segue pelo cabeçalho + sheet. O DomainShell é a RAIZ dessas áreas (fora do grupo
          (dashboard)); o Workspace do Cliente NÃO usa esta casca (tem a própria, leve) — sem duplicação. */}
      <div className="hidden md:flex shrink-0">
        <Sidebar open={false} activeTeamName={subtitle} userName={userName} userEmail={userEmail}
          avatarUrl={avatarUrl} teams={teams} />
      </div>
      <DomainNav
        config={config}
        subtitle={subtitle}
        className="hidden md:flex w-56 lg:w-60 2xl:w-64 shrink-0 border-r border-bento-border overflow-hidden pt-[env(safe-area-inset-top)]"
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Cabeçalho MOBILE fixo — em todas as páginas do domínio. */}
        <div className="md:hidden shrink-0 border-b border-bento-border pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between gap-2 h-14 px-3">
            <Link href={config.backHref} className="flex items-center gap-0.5 text-sm text-bento-muted shrink-0">
              <ChevronLeft className="w-4 h-4 shrink-0" /> {config.backLabel}
            </Link>
            <span className="font-display font-semibold text-sm text-bento-text truncate">{sectionName}</span>
            <button type="button" onClick={() => setSheetOpen(true)} className="flex items-center gap-1 text-sm text-bento-muted shrink-0">
              <Menu className="w-4 h-4" /> Seções
            </button>
          </div>
        </div>

        {/* Barra superior iPad/Desktop. pt-safe (IPAD-002, Part 3): título nunca fica atrás da status bar
            no iPad em PWA/standalone (0 no Safari/desktop, então sem mudança visual ali). */}
        <div className="hidden md:flex items-center gap-3 min-h-[56px] px-5 pt-[env(safe-area-inset-top)] border-b border-bento-border shrink-0">
          <span className="font-display font-semibold text-sm text-bento-text">{config.title}</span>
          {subtitle && <span className="text-xs text-bento-muted truncate">· {subtitle}</span>}
          <div className="ml-auto flex items-center gap-3">
            {/* Workspace Switcher global (Part 5) — mesmo canto superior direito do DashboardShell. */}
            <WorkspaceSwitcher userName={userName} userEmail={userEmail} avatarUrl={avatarUrl} teams={teams} />
          </div>
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto w-full min-w-0 max-w-6xl px-4 md:px-6 lg:px-8 pt-5 md:pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </main>
      </div>

      {/* Contexto — multi-painel só no desktop grande. */}
      <aside className="hidden 2xl:flex w-64 shrink-0 border-l border-bento-border flex-col gap-4 p-5 overflow-y-auto">
        <div className="bento-fx p-4">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Sessão</p>
          <p className="text-sm font-semibold text-bento-text mt-2 truncate">{userName}</p>
          <p className="text-[11px] text-bento-muted mt-0.5 capitalize">{role}</p>
        </div>
        <div className="bento-fx p-4">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Contexto</p>
          <p className="text-[12px] text-bento-muted mt-2 leading-relaxed">
            {config.title} do workspace. A lista de seções fica sempre à esquerda.
          </p>
        </div>
      </aside>

      {/* Bottom sheet (mobile). */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] flex flex-col rounded-t-frame bg-bento-bg border-t border-bento-border animate-slide-up pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-4 h-12 border-b border-bento-border shrink-0">
              <span className="font-display font-semibold text-sm text-bento-text">Seções</span>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Fechar" className="min-h-9 min-w-9 rounded-lg text-bento-muted hover:text-bento-text hover:bg-bento-panel transition-colors flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <DomainNav config={config} subtitle={subtitle} className="flex flex-col overflow-hidden" hideHeader onNavigate={() => setSheetOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
