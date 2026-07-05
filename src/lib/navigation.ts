import { Home, TrendingUp, Briefcase, Presentation, ShieldCheck, Settings, type LucideIcon } from 'lucide-react'
import type { ModuleLevel } from '@/lib/permissions/types'

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
  moduleKey?: string        // chave em APP_MODULES → filtra por nível efetivo ("Sem acesso" oculta o item)
  requiresManage?: boolean  // área que exige gestão de equipe (Administração)
}

export const NAV_MODULES: NavModule[] = [
  { href: '/hall',          label: 'Hall',                   Icon: Home,         group: 'main',   primary: true, moduleKey: 'hall' },
  { href: '/comercial',     label: 'Comercial',              Icon: Briefcase,    group: 'main',   primary: true, moduleKey: 'comercial' },
  { href: '/trafego',       label: 'Tráfego',                Icon: TrendingUp,   group: 'main',   primary: true, moduleKey: 'trafego' },
  { href: '/studio',        label: 'Studio de Apresentação', shortLabel: 'Studio', Icon: Presentation, group: 'main' },
  // Clientes NÃO é mais andar principal (CLIENT-HISTORY-ADMIN-003): a lista vive em Administração → Clientes
  // (/admin/clientes). A Administração abre também para quem tem o módulo 'clientes' (moduleKey abaixo): owner/dev
  // veem tudo; membro operacional entra e enxerga só Clientes (nav filtrada no /admin/layout). O Workspace do
  // cliente (/clientes/[id]) segue com requireModuleEntry('clientes').
  { href: '/admin',         label: 'Administração',          shortLabel: 'Admin',  Icon: ShieldCheck,  group: 'system', requiresManage: true, moduleKey: 'clientes' },
  { href: '/configuracoes', label: 'Configurações',          shortLabel: 'Config', Icon: Settings,     group: 'system', moduleKey: 'configuracoes' },
]

// Derivados (a UI nunca redefine a lista — só filtra a fonte única).
export const MAIN_MODULES = NAV_MODULES.filter(m => m.group === 'main')
export const SYSTEM_MODULES = NAV_MODULES.filter(m => m.group === 'system')
export const PRIMARY_MODULES = NAV_MODULES.filter(m => m.primary)

// Visibilidade de um item na navegação (PERMISSIONS-002): "Sem acesso → nem aparece". Administração exige
// gestão de equipe; itens com moduleKey somem quando o nível efetivo é 'none'; sem gate → sempre visível
// (ex.: Studio). Pura — a UI passa os níveis efetivos vindos do servidor (ModuleAccessProvider).
export function isNavModuleVisible(
  item: NavModule,
  access: Record<string, ModuleLevel>,
  canManageTeam: boolean,
): boolean {
  if (item.requiresManage) {
    if (canManageTeam) return true
    // Área de gestão que HOSPEDA um módulo interno (Administração hospeda Clientes): abre também para quem
    // tem esse módulo, mesmo sem gestão de equipe. O /admin/layout filtra a nav para mostrar só o que pode.
    if (item.moduleKey) return (access[item.moduleKey] ?? 'none') !== 'none'
    return false
  }
  if (item.moduleKey) return (access[item.moduleKey] ?? 'none') !== 'none'
  return true
}

export function visibleNavModules(
  items: NavModule[],
  access: Record<string, ModuleLevel>,
  canManageTeam: boolean,
): NavModule[] {
  return items.filter(item => isNavModuleVisible(item, access, canManageTeam))
}
