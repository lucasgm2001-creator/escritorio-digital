import { Home, TrendingUp, Briefcase, Building2, Presentation, ShieldCheck, Settings, type LucideIcon } from 'lucide-react'

// FONTE ÚNICA da navegação de módulos (EXPERIENCE-005). Sidebar, Drawer (= Sidebar) e BottomNav derivam
// TODOS daqui — nunca repetir a lista de módulos em arquivos diferentes. Um módulo novo adicionado aqui
// aparece automaticamente em todas as navegações: a BottomNav mostra os `primary` no acesso rápido e o
// restante cai no "Mais" (que abre o mesmo drawer da Sidebar).
export type NavGroup = 'main' | 'system'

export interface NavModule {
  href: string
  label: string           // rótulo completo (Sidebar / Drawer)
  shortLabel?: string      // rótulo curto (BottomNav)
  Icon: LucideIcon
  group: NavGroup
  primary?: boolean        // acesso rápido na BottomNav (Hall › Comercial › Clientes › Tráfego)
}

export const NAV_MODULES: NavModule[] = [
  { href: '/hall',          label: 'Hall',                   Icon: Home,         group: 'main',   primary: true },
  { href: '/comercial',     label: 'Comercial',              Icon: Briefcase,    group: 'main',   primary: true },
  { href: '/clientes',      label: 'Clientes',               Icon: Building2,    group: 'main',   primary: true },
  { href: '/trafego',       label: 'Tráfego',                Icon: TrendingUp,   group: 'main',   primary: true },
  { href: '/studio',        label: 'Studio de Apresentação', shortLabel: 'Studio', Icon: Presentation, group: 'main' },
  { href: '/admin',         label: 'Administração',          shortLabel: 'Admin',  Icon: ShieldCheck,  group: 'system' },
  { href: '/configuracoes', label: 'Configurações',          shortLabel: 'Config', Icon: Settings,     group: 'system' },
]

// Derivados (a UI nunca redefine a lista — só filtra a fonte única).
export const MAIN_MODULES = NAV_MODULES.filter(m => m.group === 'main')
export const SYSTEM_MODULES = NAV_MODULES.filter(m => m.group === 'system')
export const PRIMARY_MODULES = NAV_MODULES.filter(m => m.primary)
