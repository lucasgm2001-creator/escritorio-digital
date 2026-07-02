import type { LucideIcon } from 'lucide-react'

// Modelo GENÉRICO de navegação de domínio (Administração, Tráfego, ...). Uma única implementação de
// casca/nav/roadmap para todos os domínios — sem componentes duplicados (Constituição, ARCH-001).

export type DomainKey = 'admin' | 'traffic'

export type DomainGroup = { key: string; label: string }

export type DomainSection = {
  key: string
  label: string
  href: string
  group: string
  icon: LucideIcon
  tagline: string
  objetivo: string
  proximaEtapa: string
}

export type DomainConfig = {
  title: string
  backHref: string
  backLabel: string
  homePath: string
  groups: DomainGroup[]
  sections: DomainSection[]
}
