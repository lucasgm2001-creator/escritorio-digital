'use client'

import { Search } from 'lucide-react'
import { AdminNav } from './AdminNav'

// Casca da Administração. Adaptativa para as três experiências:
//  • Celular  → rail oculta; navegação por push (master no /admin, detalhe por seção).
//  • iPad     → Split View: master rail permanente + detalhe (retrato e paisagem).
//  • Desktop  → master + detalhe + painel de contexto (multi-painel).
export function AdminShell({
  activeTeamName,
  userName,
  role,
  children,
}: {
  activeTeamName: string | null
  userName: string
  role: string
  children: React.ReactNode
}) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bento-bg text-bento-text">
      <AdminNav
        className="hidden md:flex w-64 xl:w-72 shrink-0 border-r border-bento-border overflow-hidden"
        activeTeamName={activeTeamName}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior — iPad/Desktop. No celular cada página traz seu próprio cabeçalho. */}
        <div className="hidden md:flex items-center gap-3 h-14 px-5 border-b border-bento-border shrink-0">
          <span className="font-display font-semibold text-sm text-bento-text">Administração</span>
          {activeTeamName && <span className="text-xs text-bento-muted truncate">· {activeTeamName}</span>}
          <button
            type="button"
            disabled
            aria-label="Buscar (em breve)"
            className="ml-auto flex items-center gap-2 text-xs text-bento-dim border border-bento-border rounded-btn px-2.5 py-1.5 opacity-70 cursor-not-allowed"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Buscar</span>
            <kbd className="font-tech text-[10px]">⌘K</kbd>
          </button>
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 md:px-6 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
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
            Fundação da Administração. Cada área abre aqui com a lista sempre visível — menos telas, mais contexto.
          </p>
        </div>
      </aside>
    </div>
  )
}
