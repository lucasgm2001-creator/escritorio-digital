'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Briefcase, Building2, Presentation, Settings, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Barra de navegação inferior — SÓ mobile. É renderizada pelo DashboardShell apenas quando
 * `isMobile` (<1024px); no desktop (≥1024px) o shell mostra a Sidebar de sempre e NÃO renderiza
 * esta barra. Espelha EXATAMENTE os itens da nav principal (Sidebar.NAV_ITEMS) — não inventa áreas.
 * Fica no fluxo (último filho da coluna), então nunca cobre conteúdo.
 */
interface NavItem { href: string; label: string; Icon: LucideIcon }

// Espelha os itens da Sidebar do desktop (inclui o Studio — agora funciona no celular: Materiais +
// Apresentar em tela cheia; ver StudioGate/ApresentacaoTab).
const ITEMS: NavItem[] = [
  { href: '/hall',          label: 'Hall',      Icon: Home },
  { href: '/comercial',     label: 'Comercial', Icon: Briefcase },
  { href: '/clientes',      label: 'Clientes',  Icon: Building2 },
  { href: '/studio',        label: 'Studio',    Icon: Presentation },
  { href: '/configuracoes', label: 'Config',    Icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    // FIXA na base (último filho da coluna h-[100dvh] do shell, fora do scroll do <main>). Piso de 8px +
    // safe-area. tap-highlight off → o toque não deixa flash grudado; a cor verde segue SÓ a rota ativa.
    <nav className="lg:hidden shrink-0 border-t border-bento-border bg-bento-panel pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] [-webkit-tap-highlight-color:transparent]">
      <div className="flex items-stretch">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              onClick={e => e.currentTarget.blur()}   // limpa o foco após navegar (verde não persiste no item tocado)
              className={cn(
                // SEM transition-colors: a cor ativo/inativo é text-lime-fg/text-bento-muted (ambas rgb(var(--x)));
                // o Chrome NÃO interpola entre duas cores var() na navegação client-side e a transição CONGELA na
                // cor antiga (aba velha ficava verde). Tab bar deve trocar a cor NA HORA → sem transição.
                // Altura POR CONTEÚDO (não fixa): min-h-[44px] é só PISO de toque (nunca prende), e o item
                // cresce com ícone+label+py-2 → o conteúdo SEMPRE cabe na barra (fim do estouro pra cima no
                // iPhone, onde o line-height real passava do min-h-[52px] fixo com overflow visible).
                'flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 outline-none',
                'focus-visible:ring-2 focus-visible:ring-lime/50 rounded-md',
                active ? 'text-lime-fg' : 'text-bento-muted',   // cor SÓ na rota atual (sem :hover/:active grudado)
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'drop-shadow-[0_0_6px_rgba(194,247,58,0.4)]')} />
              <span className="font-tech text-[10px] tracking-tight whitespace-nowrap leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
