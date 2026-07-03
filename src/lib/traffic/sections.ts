import { TrendingUp, KeyRound, Presentation, Files, Briefcase, FolderOpen, Trophy, Users, FileText, Sparkles, SlidersHorizontal } from 'lucide-react'
import type { DomainGroup, DomainSection } from '@/lib/domain/nav'

// Organização DEFINITIVA do domínio TRÁFEGO (TRAFFIC-002). SÓ estrutura/navegação — nenhuma integração,
// API, banco ou lógica. Mesma casca genérica (DomainShell) de Admin/Cliente.

export const TRAFFIC_GROUPS: DomainGroup[] = [
  { key: 'visao', label: 'Visão' },
  { key: 'gestao', label: 'Gestão' },
  { key: 'medicao', label: 'Medição' },
  { key: 'inteligencia', label: 'Inteligência' },
  { key: 'plataforma', label: 'Plataforma' },
]

export const TRAFFIC_SECTIONS: DomainSection[] = [
  { key: 'dashboard', group: 'visao', label: 'Dashboard', href: '/trafego', icon: TrendingUp,
    tagline: 'Visão executiva de mídia paga.', objetivo: 'Investimento, receita, ROAS, CPA e alertas num só lugar.', proximaEtapa: 'Conectar contas de anúncio.' },
  { key: 'contas', group: 'gestao', label: 'Contas', href: '/trafego/contas', icon: KeyRound,
    tagline: 'Plataformas e contas conectadas.', objetivo: 'Meta, Google, GA4, Search Console, TikTok e LinkedIn.', proximaEtapa: 'Conectar a primeira plataforma.' },
  { key: 'campanhas', group: 'gestao', label: 'Campanhas', href: '/trafego/campanhas', icon: Presentation,
    tagline: 'Campanhas ativas e desempenho.', objetivo: 'Status, objetivo, investimento e resultados.', proximaEtapa: 'Sincronizar campanhas das contas.' },
  { key: 'conjuntos', group: 'gestao', label: 'Conjuntos', href: '/trafego/conjuntos', icon: Files,
    tagline: 'Conjuntos de anúncios.', objetivo: 'Segmentação, orçamento e entrega por conjunto.', proximaEtapa: 'Importar conjuntos das campanhas.' },
  { key: 'anuncios', group: 'gestao', label: 'Anúncios', href: '/trafego/anuncios', icon: Briefcase,
    tagline: 'Anúncios individuais.', objetivo: 'Criativo, status e resultado por anúncio.', proximaEtapa: 'Importar anúncios dos conjuntos.' },
  { key: 'criativos', group: 'gestao', label: 'Criativos', href: '/trafego/criativos', icon: FolderOpen,
    tagline: 'Biblioteca de criativos.', objetivo: 'Imagens, vídeos, copies e performance.', proximaEtapa: 'Importar criativos das campanhas.' },
  { key: 'conversoes', group: 'medicao', label: 'Conversões', href: '/trafego/conversoes', icon: Trophy,
    tagline: 'Pixel e eventos de conversão.', objetivo: 'Purchase, Lead, Checkout e eventos custom.', proximaEtapa: 'Conectar Pixel e Conversions API.' },
  { key: 'analytics', group: 'medicao', label: 'Analytics', href: '/trafego/analytics', icon: Users,
    tagline: 'Audiência e comportamento.', objetivo: 'Usuários, sessões, origens e páginas.', proximaEtapa: 'Conectar o GA4.' },
  { key: 'relatorios', group: 'inteligencia', label: 'Relatórios', href: '/trafego/relatorios', icon: FileText,
    tagline: 'Relatórios de mídia.', objetivo: 'Mensal, executivo, comparativos e exportações.', proximaEtapa: 'Consumir o Reporting Engine.' },
  { key: 'ia', group: 'inteligencia', label: 'IA', href: '/trafego/ia', icon: Sparkles,
    tagline: 'Copiloto de tráfego.', objetivo: 'Resumos, anomalias, oportunidades e briefings.', proximaEtapa: 'Consumir o AI Engine.' },
  { key: 'configuracoes', group: 'plataforma', label: 'Configurações', href: '/trafego/configuracoes', icon: SlidersHorizontal,
    tagline: 'Preferências do módulo.', objetivo: 'Conta padrão, moeda, atribuição e sincronização.', proximaEtapa: 'Definir os padrões da equipe.' },
]

export function getTrafficSection(key: string): DomainSection | undefined {
  return TRAFFIC_SECTIONS.find(section => section.key === key)
}
