'use client'

import { useEffect, useState } from 'react'
import { BrandMark } from '@/components/brand/BrandMark'
import { WorkspaceSwitcher, type SwitcherTeam } from './WorkspaceSwitcher'

interface TopbarProps {
  title: string
  onMenuToggle: () => void
  sidebarOpen: boolean
  userName?: string
  userInitial?: string
  userId?: string
  avatarUrl?: string | null
  userEmail?: string | null
  teams?: SwitcherTeam[]
}

// O fuso IANA (America/...) já resolve o horário de verão dos EUA automaticamente.
function LiveClock({ timezone, label, short, primary }: { timezone: string; label: string; short: string; primary?: boolean }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('pt-BR', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit',
    }))
    update()
    const id = setInterval(update, 15_000)
    return () => clearInterval(id)
  }, [timezone])

  // Brasília (principal) destacada em lime; demais fusos em cinza. Hora em JetBrains
  // Mono (font-mono). Atualização a cada 15s = funcional, não enfeite.
  // Celular: rótulo curto (BSB/NY/DEN/LA) p/ caber numa linha só; desktop: rótulo completo (intacto).
  const labelCls = `text-[9px] uppercase tracking-wide whitespace-nowrap ${primary ? 'text-lime-fg font-semibold' : 'text-bento-muted'}`
  return (
    <div className="flex flex-col items-center leading-none gap-0.5">
      <span className={`${labelCls} lg:hidden`}>{short}</span>
      <span className={`${labelCls} hidden lg:inline`}>{label}</span>
      <span suppressHydrationWarning className={`font-mono text-[11px] lg:text-xs font-semibold tabular-nums whitespace-nowrap ${primary ? 'text-bento-text' : 'text-bento-dim'}`}>{time || '--:--'}</span>
    </div>
  )
}

export function Topbar({ onMenuToggle, userName = 'Usuário', avatarUrl, userEmail, teams = [] }: TopbarProps) {
  return (
    <header className="min-h-[56px] pt-safe border-b border-[#2d3748] bg-[#0d1117] flex items-center px-4 gap-4 shrink-0">
      <button
        onClick={onMenuToggle}
        className="p-1.5 rounded-lg hover:bg-[#1e2533] transition-colors text-slate-500 hover:text-slate-300 min-w-[36px] min-h-[36px] hidden lg:flex items-center justify-center"
        aria-label="Alternar menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Marca do app no cabeçalho MOBILE — símbolo oficial + wordmark. Desktop usa a Sidebar (lg:hidden).
          O hambúrguer é hidden lg:flex, então no mobile a marca ocupa a esquerda sem empurrar nada. */}
      <div className="flex items-center gap-2 shrink-0 lg:hidden">
        <BrandMark size={28} decorative className="shrink-0" />
        <span className="font-display font-bold text-foreground text-[15px] tracking-tight">Escritório Digital</span>
      </div>

      {/* Título da seção REMOVIDO daqui — cada página já tem seu próprio título. Topbar mantém relógios +
          Workspace Switcher (Part 5). */}
      <div className="ml-auto flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 lg:gap-3.5 border-r border-[#2d3748] pr-3 sm:pr-4 shrink-0">
          <LiveClock timezone="America/Sao_Paulo" label="Brasília" short="BSB" primary />
          <LiveClock timezone="America/New_York"    label="EUA Leste" short="NY" />
          <LiveClock timezone="America/Denver"      label="EUA Mont." short="DEN" />
          <LiveClock timezone="America/Los_Angeles" label="EUA Oeste" short="LA" />
        </div>

        <WorkspaceSwitcher userName={userName} userEmail={userEmail ?? null} avatarUrl={avatarUrl ?? null} teams={teams} />
      </div>
    </header>
  )
}
