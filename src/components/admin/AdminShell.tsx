'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Search, Menu, ChevronLeft, X } from 'lucide-react'
import { AdminNav } from './AdminNav'
import { ADMIN_SECTIONS } from '@/lib/admin/sections'

// Casca da Administração. Mobile: cabeçalho fixo (← Hall / seção / Seções) + bottom sheet de seções.
// iPad/Desktop: rail lateral permanente (+ painel de contexto no desktop grande).
export function AdminShell({ activeTeamName, userName, role, children }: {
  activeTeamName: string | null
  userName: string
  role: string
  children: React.ReactNode
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const pathname = usePathname()
  const current = ADMIN_SECTIONS.find(section => pathname === section.href || pathname.startsWith(section.href + '/'))
  const sectionName = pathname === '/admin' ? 'Administração' : (current?.label ?? 'Administração')

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bento-bg text-bento-text">
      <AdminNav
        className="hidden md:flex w-64 xl:w-72 shrink-0 border-r border-bento-border overflow-hidden"
        activeTeamName={activeTeamName}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Cabeçalho MOBILE fixo — em TODAS as páginas de /admin. */}
        <div className="md:hidden shrink-0 border-b border-bento-border pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between gap-2 h-14 px-3">
            <Link href="/hall" className="flex items-center gap-0.5 text-sm text-bento-muted shrink-0">
              <ChevronLeft className="w-4 h-4 shrink-0" /> Hall
            </Link>
            <span className="font-display font-semibold text-sm text-bento-text truncate">{sectionName}</span>
            <button type="button" onClick={() => setSheetOpen(true)} className="flex items-center gap-1 text-sm text-bento-muted shrink-0">
              <Menu className="w-4 h-4" /> Seções
            </button>
          </div>
        </div>

        {/* Barra superior iPad/Desktop. */}
        <div className="hidden md:flex items-center gap-3 h-14 px-5 border-b border-bento-border shrink-0">
          <span className="font-display font-semibold text-sm text-bento-text">Administração</span>
          {activeTeamName && <span className="text-xs text-bento-muted truncate">· {activeTeamName}</span>}
          <button type="button" disabled aria-label="Buscar (em breve)"
            className="ml-auto flex items-center gap-2 text-xs text-bento-dim border border-bento-border rounded-btn px-2.5 py-1.5 opacity-70 cursor-not-allowed">
            <Search className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Buscar</span>
            <kbd className="font-tech text-[10px]">⌘K</kbd>
          </button>
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 md:px-6 pt-5 md:pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </main>
      </div>

      {/* Contexto — multi-painel só no desktop grande. */}
      <aside className="hidden xl:flex w-72 shrink-0 border-l border-bento-border flex-col gap-4 p-5">
        <div className="bento-fx p-4">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Sessão</p>
          <p className="text-sm font-semibold text-bento-text mt-2 truncate">{userName}</p>
          <p className="text-[11px] text-bento-muted mt-0.5 capitalize">{role}</p>
        </div>
        <div className="bento-fx p-4">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Contexto</p>
          <p className="text-[12px] text-bento-muted mt-2 leading-relaxed">
            Painel administrativo do workspace. A lista de seções fica sempre à esquerda.
          </p>
        </div>
      </aside>

      {/* Bottom sheet (mobile) — seções agrupadas; fecha ao navegar. */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[82vh] flex flex-col rounded-t-frame bg-bento-bg border-t border-bento-border animate-slide-up pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-4 h-12 border-b border-bento-border shrink-0">
              <span className="font-display font-semibold text-sm text-bento-text">Seções</span>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Fechar" className="p-1 text-bento-muted hover:text-bento-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <AdminNav className="flex flex-col overflow-hidden" hideHeader onNavigate={() => setSheetOpen(false)} activeTeamName={activeTeamName} />
          </div>
        </div>
      )}
    </div>
  )
}
