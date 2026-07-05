import { Building2, Clock, Wallet, TrendingUp, Briefcase, FolderOpen, Users, CalendarDays, FileText, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react'
import type { DomainConfig, DomainGroup, DomainSection } from '@/lib/domain/nav'

// Fundação do WORKSPACE DO CLIENTE (CLIENT-001). Estrutura/navegação — nenhuma integração, banco ou IA.
// href aqui é o SEGMENTO relativo; buildClientConfig transforma em /clientes/{id}/{seg} (resumo = base).

export const CLIENT_GROUPS: DomainGroup[] = [
  { key: 'visao', label: 'Visão' },
  { key: 'operacao', label: 'Operação' },
  { key: 'inteligencia', label: 'Inteligência' },
  { key: 'plataforma', label: 'Plataforma' },
]

export const CLIENT_SECTIONS: DomainSection[] = [
  { key: 'resumo', group: 'visao', label: 'Resumo', href: '', icon: Building2,
    tagline: 'Dashboard executivo do cliente.', objetivo: 'Empresa, plano, responsável e saúde num só lugar.', proximaEtapa: 'Conectar reuniões, relatórios e campanhas.' },
  { key: 'timeline', group: 'visao', label: 'Timeline', href: 'timeline', icon: Clock,
    tagline: 'História do relacionamento.', objetivo: 'Reusar a timeline universal do Lead Hub.', proximaEtapa: 'Ligar as interações do cliente.' },
  { key: 'financeiro', group: 'operacao', label: 'Financeiro', href: 'financeiro', icon: Wallet,
    tagline: 'Mensalidades e recebimentos.', objetivo: 'Pendências, histórico e notas.', proximaEtapa: 'Conectar os pagamentos do cliente.' },
  { key: 'trafego', group: 'operacao', label: 'Tráfego', href: 'trafego', icon: TrendingUp,
    tagline: 'Mídia paga do cliente.', objetivo: 'Reusar o módulo Tráfego filtrado por cliente.', proximaEtapa: 'Conectar contas de anúncio.' },
  { key: 'projetos', group: 'operacao', label: 'Projetos', href: 'projetos', icon: Briefcase,
    tagline: 'Entregas e roadmap.', objetivo: 'Projetos ativos, checklist e entregas.', proximaEtapa: 'Definir o modelo de projeto.' },
  { key: 'arquivos', group: 'operacao', label: 'Arquivos', href: 'arquivos', icon: FolderOpen,
    tagline: 'Contratos, criativos e materiais.', objetivo: 'Biblioteca de arquivos do cliente.', proximaEtapa: 'Definir o armazenamento.' },
  { key: 'equipe', group: 'operacao', label: 'Equipe', href: 'equipe', icon: Users,
    tagline: 'Quem atende o cliente.', objetivo: 'Responsáveis e papéis.', proximaEtapa: 'Vincular colaboradores.' },
  { key: 'agenda', group: 'operacao', label: 'Agenda', href: 'agenda', icon: CalendarDays,
    tagline: 'Reuniões e follow-ups.', objetivo: 'Eventos do cliente no calendário.', proximaEtapa: 'Conectar a Agenda.' },
  { key: 'relatorios', group: 'inteligencia', label: 'Relatórios', href: 'relatorios', icon: FileText,
    tagline: 'Relatórios mensais e exportações.', objetivo: 'Histórico de PDFs do cliente.', proximaEtapa: 'Reusar o Reporting Engine.' },
  { key: 'ia', group: 'inteligencia', label: 'IA', href: 'ia', icon: Sparkles,
    tagline: 'Copiloto do cliente.', objetivo: 'Resumo, riscos e próximas ações.', proximaEtapa: 'Consumir o AI Engine.' },
  { key: 'integracoes', group: 'plataforma', label: 'Integrações', href: 'integracoes', icon: ExternalLink,
    tagline: 'Conexões do cliente.', objetivo: 'Meta, Google, WhatsApp, Make, N8N, webhooks e API.', proximaEtapa: 'Coexistir com as integrações atuais (INT-001).' },
  { key: 'auditoria', group: 'plataforma', label: 'Auditoria', href: 'auditoria', icon: ShieldCheck,
    tagline: 'Trilha administrativa.', objetivo: 'Quem fez o quê e quando.', proximaEtapa: 'Ligar o log de eventos.' },
]

export function getClientSection(key: string): DomainSection | undefined {
  return CLIENT_SECTIONS.find(section => section.key === key)
}

// Config resolvido (hrefs absolutos por id) — consumido pela casca genérica (DomainShell) no cliente.
export function buildClientConfig(clientId: string, clientName: string): DomainConfig {
  return {
    title: clientName,
    // Volta para a LISTA, que agora vive em Administração → Clientes (CLIENT-HISTORY-ADMIN-003). Direto, sem o
    // hop do redirect /clientes. O Workspace em si segue em /clientes/{id} (rota própria, casca leve).
    backHref: '/admin/clientes',
    backLabel: 'Clientes',
    homePath: `/clientes/${clientId}`,
    groups: CLIENT_GROUPS,
    sections: CLIENT_SECTIONS.map(section => ({
      ...section,
      href: section.href ? `/clientes/${clientId}/${section.href}` : `/clientes/${clientId}`,
    })),
  }
}
