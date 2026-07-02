import { ADMIN_GROUPS, ADMIN_SECTIONS } from '@/lib/admin/sections'
import { TRAFFIC_GROUPS, TRAFFIC_SECTIONS } from '@/lib/traffic/sections'
import type { DomainConfig, DomainKey, DomainSection } from './nav'

// Registro ÚNICO das configs de domínio (título, back, seções). A casca genérica lê daqui por chave —
// os ícones (lucide) são resolvidos aqui (import), nunca passados como prop entre server↔client.

function adminSections(): DomainSection[] {
  return ADMIN_SECTIONS.map(section => ({
    key: section.key,
    label: section.label,
    href: section.href,
    group: section.group,
    icon: section.icon,
    tagline: section.tagline,
    objetivo: section.tagline,
    proximaEtapa: section.planned[0] ?? 'Definir escopo',
  }))
}

export const DOMAIN_CONFIGS: Record<DomainKey, DomainConfig> = {
  admin: {
    title: 'Administração', backHref: '/hall', backLabel: 'Hall', homePath: '/admin',
    groups: ADMIN_GROUPS, sections: adminSections(),
  },
  traffic: {
    title: 'Tráfego', backHref: '/hall', backLabel: 'Hall', homePath: '/trafego',
    groups: TRAFFIC_GROUPS, sections: TRAFFIC_SECTIONS,
  },
}

export function getDomainSection(configKey: DomainKey, sectionKey: string): DomainSection | undefined {
  return DOMAIN_CONFIGS[configKey].sections.find(section => section.key === sectionKey)
}
