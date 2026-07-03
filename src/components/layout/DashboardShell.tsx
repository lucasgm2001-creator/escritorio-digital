'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import type { SwitcherTeam } from './WorkspaceSwitcher'
import { BottomNav } from '@/components/mobile/BottomNav'
import { RevalidateOnFocus } from '@/components/system/RevalidateOnFocus'
import { ThemeWatcher } from '@/components/system/ThemeWatcher'

interface DashboardShellProps {
  children: React.ReactNode
  userName: string
  userId: string
  avatarUrl: string | null
  pageTitles: Record<string, string>
  activeTeamName: string | null
  userEmail: string | null
  teams: SwitcherTeam[]
}

export function DashboardShell({ children, userName, userId, avatarUrl, pageTitles, activeTeamName, userEmail, teams }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [isMobile, setIsMobile]       = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const check = () => {
      // Fronteira ÚNICA da reforma mobile: <1024px = mobile (BottomNav); ≥1024px = desktop (Sidebar) intocado.
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const title = Object.entries(pageTitles).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? 'Dashboard'

  const handleMenuToggle = () => {
    if (isMobile) {
      setMobileOpen(o => !o)
    } else {
      setSidebarOpen(o => !o)
    }
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Revalida dados ao focar a aba + reavalia o tema (dia/noite) ao vivo. Sem UI. */}
      <RevalidateOnFocus />
      <ThemeWatcher />
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
          activeTeamName={activeTeamName}
        />
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed left-0 top-0 h-[100dvh] z-50">
            <Sidebar
              open={true}
              onToggle={() => setMobileOpen(false)}
              mobileClose={() => setMobileOpen(false)}
              activeTeamName={activeTeamName}
            />
          </div>
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <Topbar
          title={title}
          onMenuToggle={handleMenuToggle}
          sidebarOpen={isMobile ? mobileOpen : sidebarOpen}
          userName={userName}
          userInitial={userName[0]?.toUpperCase() ?? 'U'}
          userId={userId}
          avatarUrl={avatarUrl}
          userEmail={userEmail}
          teams={teams}
        />
        {/* ÚNICO container que rola na vertical (header e bottom-nav ficam fixos). */}
        <main className="flex-1 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
          {children}
        </main>
        {/* Navegação inferior — só mobile (<1024px); fica no fluxo, abaixo do main, sem cobrir conteúdo.
            "Mais" abre o mesmo drawer (Sidebar) do hambúrguer → todos os andares acessíveis no celular. */}
        {isMobile && <BottomNav onMore={() => setMobileOpen(true)} />}
      </div>
    </div>
  )
}
