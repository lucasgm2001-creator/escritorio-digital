'use client'

import { useEffect, useRef, useState } from 'react'
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
// UM relógio para os quatro fusos (eram 4 intervalos de 15s, um por fuso). Alinha a troca ao minuto cheio:
// antes o horário podia ficar até 15s atrasado; agora vira junto com o relógio do celular.
function useMinuteTick(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])
  return now
}

function LiveClock({ now, timezone, label, short, primary }: { now: number | null; timezone: string; label: string; short: string; primary?: boolean }) {
  const time = now == null ? '' : new Date(now).toLocaleTimeString('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })

  // Brasília (principal) destacada em lime; demais fusos em cinza. Hora em JetBrains Mono (font-mono).
  // Celular: rótulo curto (BSB/NY/DEN/LA) p/ caber numa linha só; desktop: rótulo completo (intacto).
  const labelCls = `text-[10px] uppercase tracking-wide whitespace-nowrap ${primary ? 'text-lime-fg font-semibold' : 'text-bento-muted'}`
  return (
    <div className="flex flex-col items-center leading-none gap-0.5">
      <span className={`${labelCls} lg:hidden`}>{short}</span>
      <span className={`${labelCls} hidden lg:inline`}>{label}</span>
      <span suppressHydrationWarning className={`font-mono text-[11px] lg:text-xs font-semibold tabular-nums whitespace-nowrap ${primary ? 'text-bento-text' : 'text-bento-dim'}`}>{time || '--:--'}</span>
    </div>
  )
}

// A cor do SISTEMA (barra de status do app instalado, barra do navegador no Android) acompanha a topbar: o
// theme-color fixo era o escuro, então no tema claro a faixa de cima destoava do cabeçalho.
function useSystemBarColor(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const apply = () => {
      const el = ref.current
      if (!el) return
      const color = getComputedStyle(el).backgroundColor
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta) }
      if (meta.content !== color) meta.content = color
    }
    apply()
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [ref])
}

export function Topbar({ onMenuToggle, userName = 'Usuário', avatarUrl, userEmail, teams = [] }: TopbarProps) {
  const now = useMinuteTick()
  const ref = useRef<HTMLElement>(null)
  useSystemBarColor(ref)
  return (
    // sticky top-0 + fundo sólido: no iOS 26 o Safari desenha a página por baixo da barra de status e DESFOCA o
    // que fica ali — a não ser que seja uma barra fixa no topo, cuja cor ele estende até lá em cima. Era o
    // "embaçado" sobre a logo/relógios/foto. (A coluna não rola; sticky só sinaliza "barra de topo".)
    // Laterais respeitam o recorte do iPhone deitado (safe-area-inset-left/right).
    <header ref={ref}
      className="sticky top-0 z-40 min-h-[56px] pt-safe border-b border-[#2d3748] bg-[#0d1117] flex items-center gap-4 shrink-0 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
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
        <span className="hidden sm:inline font-display font-bold text-foreground text-[15px] tracking-tight whitespace-nowrap">Escritório Digital</span>
      </div>

      {/* Título da seção REMOVIDO daqui — cada página já tem seu próprio título. Topbar mantém relógios +
          Workspace Switcher (Part 5). */}
      <div className="ml-auto flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 lg:gap-3.5 border-r border-[#2d3748] pr-3 sm:pr-4 shrink-0">
          <LiveClock now={now} timezone="America/Sao_Paulo" label="Brasília" short="BSB" primary />
          <div className="hidden min-[360px]:block"><LiveClock now={now} timezone="America/New_York" label="EUA Leste" short="NY" /></div>
          <div className="hidden min-[360px]:block"><LiveClock now={now} timezone="America/Denver" label="EUA Mont." short="DEN" /></div>
          <div className="hidden min-[360px]:block"><LiveClock now={now} timezone="America/Los_Angeles" label="EUA Oeste" short="LA" /></div>
        </div>

        <div className="lg:hidden">
          <WorkspaceSwitcher userName={userName} userEmail={userEmail ?? null} avatarUrl={avatarUrl ?? null} teams={teams} />
        </div>
      </div>
    </header>
  )
}
