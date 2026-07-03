'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, TrendingUp, Briefcase, Building2, Menu, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Barra de navegação inferior — SÓ mobile (<1024px). Renderizada pelo DashboardShell.
 * Acesso rápido aos andares primários (ordem oficial: Hall › Tráfego › Comercial › Clientes) + um botão
 * "Mais" que abre o menu lateral (Sidebar drawer) com TODOS os andares — nada fica escondido no celular.
 * Fica no fluxo (último filho da coluna), então nunca cobre conteúdo.
 */
interface NavItem { href: string; label: string; Icon: LucideIcon }

// Andares primários no acesso rápido. Os demais (Studio, Administração, Configurações) estão a UM toque
// no "Mais". Financeiro/Agenda/Relatórios/IA ainda não são andares de topo (existem como sub-seções) —
// por isso não entram na nav: linkar rota inexistente daria 404.
const PRIMARY: NavItem[] = [
  { href: '/hall',      label: 'Hall',      Icon: Home },
  { href: '/trafego',   label: 'Tráfego',   Icon: TrendingUp },
  { href: '/comercial', label: 'Comercial', Icon: Briefcase },
  { href: '/clientes',  label: 'Clientes',  Icon: Building2 },
]

const itemCls = 'flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 outline-none focus-visible:ring-2 focus-visible:ring-lime/50 rounded-md [-webkit-tap-highlight-color:transparent]'

export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="lg:hidden shrink-0 border-t border-bento-border bg-bento-panel pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] [-webkit-tap-highlight-color:transparent]">
      <div className="flex items-stretch">
        {PRIMARY.map(({ href, label, Icon }) => {
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
              <span className="font-tech text-[10px] tracking-tight whitespace-nowrap leading-none">{label}</span>
            </Link>
          )
        })}
        {/* "Mais" — abre o menu lateral (Sidebar) com TODOS os andares. Nada escondido no celular. */}
        <button type="button" onClick={onMore} aria-label="Mais andares" className={cn(itemCls, 'text-bento-muted')}>
          <Menu className="w-5 h-5" />
          <span className="font-tech text-[10px] tracking-tight whitespace-nowrap leading-none">Mais</span>
        </button>
      </div>
    </nav>
  )
}
