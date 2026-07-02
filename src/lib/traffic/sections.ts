import { TrendingUp, Users, KeyRound, Presentation, FolderOpen, FileText, Sparkles, ExternalLink } from 'lucide-react'
import type { DomainGroup, DomainSection } from '@/lib/domain/nav'

// Fundação do domínio TRÁFEGO (mídia paga). SÓ organização/navegação — nenhuma integração, API, banco
// ou lógica. Estrutura espelha a Administração (mesma casca genérica).

export const TRAFFIC_GROUPS: DomainGroup[] = [
  { key: 'visao', label: 'Visão' },
  { key: 'gestao', label: 'Gestão' },
  { key: 'inteligencia', label: 'Inteligência' },
  { key: 'plataforma', label: 'Plataforma' },
]

export const TRAFFIC_SECTIONS: DomainSection[] = [
  { key: 'dashboard', group: 'visao', label: 'Dashboard', href: '/trafego', icon: TrendingUp,
    tagline: 'Visão executiva de mídia paga.', objetivo: 'Investimento, receita, ROAS, CPA e alertas num só lugar.', proximaEtapa: 'Conectar contas de anúncio.' },
  { key: 'clientes', group: 'gestao', label: 'Clientes', href: '/trafego/clientes', icon: Users,
    tagline: 'Tráfego por cliente.', objetivo: 'Desempenho de mídia de cada cliente, isolado.', proximaEtapa: 'Reusar o dashboard filtrado por cliente.' },
  { key: 'contas', group: 'gestao', label: 'Contas de anúncio', href: '/trafego/contas', icon: KeyRound,
    tagline: 'Contas conectadas por plataforma.', objetivo: 'Conectar Meta, Google, TikTok e LinkedIn Ads.', proximaEtapa: 'Centro de integrações de mídia.' },
  { key: 'campanhas', group: 'gestao', label: 'Campanhas', href: '/trafego/campanhas', icon: Presentation,
    tagline: 'Campanhas, conjuntos e anúncios.', objetivo: 'Acompanhar campanhas ativas e desempenho.', proximaEtapa: 'Sincronizar campanhas das contas conectadas.' },
  { key: 'criativos', group: 'gestao', label: 'Criativos', href: '/trafego/criativos', icon: FolderOpen,
    tagline: 'Biblioteca de criativos.', objetivo: 'Comparar criativos por desempenho.', proximaEtapa: 'Importar criativos das campanhas.' },
  { key: 'relatorios', group: 'inteligencia', label: 'Relatórios', href: '/trafego/relatorios', icon: FileText,
    tagline: 'Relatórios de mídia.', objetivo: 'Relatórios executivos e por cliente.', proximaEtapa: 'Consumir o Reporting Engine.' },
  { key: 'ia', group: 'inteligencia', label: 'IA', href: '/trafego/ia', icon: Sparkles,
    tagline: 'Copiloto de tráfego.', objetivo: 'Resumos, oportunidades e alertas automáticos.', proximaEtapa: 'Consumir o AI Engine.' },
  { key: 'integracoes', group: 'plataforma', label: 'Integrações', href: '/trafego/integracoes', icon: ExternalLink,
    tagline: 'Fontes de mídia do workspace.', objetivo: 'Meta/Google/TikTok/LinkedIn + Pixel e CAPI.', proximaEtapa: 'Coexistir com as integrações atuais (INT-001).' },
]

export function getTrafficSection(key: string): DomainSection | undefined {
  return TRAFFIC_SECTIONS.find(section => section.key === key)
}
