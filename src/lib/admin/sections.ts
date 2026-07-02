import type { LucideIcon } from 'lucide-react'
import {
  Building2, Users, FolderOpen, Briefcase, Wallet, ShieldCheck,
  Sparkles, ExternalLink, KeyRound, FileText, TrendingUp, Clock, UserPlus,
} from 'lucide-react'

// Fonte única da estrutura da Administração (Constituição: informação única).
// Isto é só o modelo de navegação/organização — nenhuma regra de negócio.

export type AdminSectionKey =
  | 'empresa' | 'equipe' | 'departamentos' | 'cargos' | 'colaboradores' | 'remuneracao'
  | 'permissoes' | 'automacoes' | 'integracoes' | 'api' | 'auditoria'
  | 'billing' | 'logs'

export type AdminGroupKey = 'organizacao' | 'regras' | 'plataforma' | 'observabilidade'

export type AdminBlueprint = 'people' | 'compensation'

export type AdminSection = {
  key: AdminSectionKey
  label: string
  href: string
  group: AdminGroupKey
  icon: LucideIcon
  tagline: string
  description: string
  planned: string[]
  blueprint?: AdminBlueprint
}

export const ADMIN_GROUPS: { key: AdminGroupKey; label: string }[] = [
  { key: 'organizacao', label: 'Organização' },
  { key: 'regras', label: 'Regras & Governança' },
  { key: 'plataforma', label: 'Plataforma' },
  { key: 'observabilidade', label: 'Observabilidade' },
]

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: 'empresa', label: 'Empresa', href: '/admin/empresa', group: 'organizacao', icon: Building2,
    tagline: 'Identidade, dados e preferências do workspace.',
    description: 'O cadastro central do seu workspace no Escritório Digital — nome, marca, fuso, moeda e dados fiscais. É a base que todas as outras áreas herdam.',
    planned: ['Identidade e marca do workspace', 'Fuso horário, moeda e localização', 'Dados cadastrais e fiscais', 'Preferências globais da empresa'],
  },
  {
    key: 'equipe', label: 'Equipe', href: '/admin/equipe', group: 'organizacao', icon: UserPlus,
    tagline: 'Membros, convites e acesso ao workspace.',
    description: 'Quem faz parte do workspace e como entra. Convites por token, papéis e ativação — a porta de entrada multi-tenant do SaaS.',
    planned: ['Lista de membros e papéis', 'Convites por token (gerar, copiar, revogar)', 'Ativação e desligamento de membros', 'Transferência de propriedade'],
  },
  {
    key: 'departamentos', label: 'Departamentos', href: '/admin/departamentos', group: 'organizacao', icon: FolderOpen,
    tagline: 'As áreas da empresa — o topo da estrutura de pessoas.',
    description: 'Departamentos são o primeiro nível do modelo de pessoas. Agrupam cargos e dão contexto organizacional, preparando relatórios e permissões por área.',
    planned: ['Criar e organizar departamentos', 'Associar cargos a cada departamento', 'Visão da estrutura organizacional', 'Base para relatórios por área'],
    blueprint: 'people',
  },
  {
    key: 'cargos', label: 'Cargos', href: '/admin/cargos', group: 'organizacao', icon: Briefcase,
    tagline: 'Papéis profissionais reutilizáveis (Closer, SDR...).',
    description: 'Cargos definem o papel profissional de uma pessoa, separado de como ela é remunerada. Um cargo se conecta a um template de remuneração e é reutilizável entre colaboradores.',
    planned: ['Catálogo de cargos por departamento', 'Vínculo cargo → template de remuneração', 'Colaboradores por cargo', 'Reuso do mesmo cargo em várias pessoas'],
    blueprint: 'people',
  },
  {
    key: 'colaboradores', label: 'Colaboradores', href: '/admin/colaboradores', group: 'organizacao', icon: Users,
    tagline: 'As pessoas da empresa — departamento, cargo, template e gestor.',
    description: 'O domínio de Pessoas: colaboradores com departamento, cargo, template de remuneração, gestor, status e histórico. A base de permissões, remuneração e automações.',
    planned: ['Cadastro completo de colaboradores', 'Vínculo departamento · cargo · template · gestor', 'Status, histórico e documentos', 'Base para permissões e remuneração'],
  },
  {
    key: 'remuneracao', label: 'Remuneração', href: '/admin/remuneracao', group: 'regras', icon: Wallet,
    tagline: 'Templates de remuneração — configure uma vez, aplique a muitos.',
    description: 'A futura central de remuneração por template: salário, comissões, limites, tetos, aceleradores e vigência — sem escrever código e sem tocar no histórico. Cada pagamento guardará o snapshot da regra usada.',
    planned: ['Templates de remuneração (Closer DR Growth, SDR...)', 'Regras: salário, comissão, limites, tetos, bônus', 'Assignment colaborador → template com vigência', 'Ledger imutável e pagamentos derivados'],
    blueprint: 'compensation',
  },
  {
    key: 'permissoes', label: 'Permissões', href: '/admin/permissoes', group: 'regras', icon: ShieldCheck,
    tagline: 'Quem vê, configura, aprova e consulta — por módulo.',
    description: 'A matriz definitiva de permissões (Owner, Admin, Manager, Member) por módulo. A segurança viverá no servidor e no banco (RLS), nunca apenas escondendo botões.',
    planned: ['Papéis: Owner, Admin, Manager, Member', 'Matriz por módulo: ver / configurar / aprovar / consultar', 'Escopo por equipe e workspace', 'Reflexo em RLS (não só na interface)'],
  },
  {
    key: 'automacoes', label: 'Automações', href: '/admin/automacoes', group: 'regras', icon: Sparkles,
    tagline: "Regras 'SE evento ENTÃO ação' — trabalho que se faz sozinho.",
    description: 'A área que transforma acontecimentos em automação declarativa. Preparada para o motor de eventos e automações — sem lógica embutida em código.',
    planned: ['Regras declarativas orientadas a eventos', 'Gatilhos: venda, pagamento, upgrade, meta...', 'Ações: liberar comissão, notificar, agendar follow-up', 'Histórico e status de cada automação'],
  },
  {
    key: 'integracoes', label: 'Integrações', href: '/admin/integracoes', group: 'plataforma', icon: ExternalLink,
    tagline: 'Fontes externas do workspace, coexistindo com o que já roda.',
    description: 'O centro de integrações por workspace (Meta, Google, WhatsApp, Make e mais). Tudo construído ao lado do que já existe — nunca reescrevendo as integrações atuais.',
    planned: ['Conectar fontes por workspace', 'Status e saúde de cada integração', 'Credenciais escopadas por equipe', 'Coexistência com Magnetic/Meta/Make/webhooks'],
  },
  {
    key: 'api', label: 'API', href: '/admin/api', group: 'plataforma', icon: KeyRound,
    tagline: 'Chaves de API e webhooks escopados por workspace.',
    description: 'A superfície de plataforma para terceiros: chaves, secrets e webhooks — sempre escopados por workspace e por permissão. Base do futuro ecossistema.',
    planned: ['Chaves de API por workspace', 'Webhooks de saída', 'Escopos e rotação de segredos', 'Registro de uso'],
  },
  {
    key: 'auditoria', label: 'Auditoria', href: '/admin/auditoria', group: 'observabilidade', icon: FileText,
    tagline: 'Trilha imutável de quem fez o quê.',
    description: 'O registro de negócio imutável: quem fez, o quê e quando. Histórico que nunca é editado nem apagado — a memória confiável do workspace.',
    planned: ['Trilha de ações por usuário', 'Filtro por módulo, pessoa e período', 'Registros imutáveis (append-only)', 'Exportação para conformidade'],
  },
  {
    key: 'billing', label: 'Billing', href: '/admin/billing', group: 'plataforma', icon: TrendingUp,
    tagline: 'A assinatura do workspace no SaaS.',
    description: 'A relação comercial do Escritório Digital com este workspace: plano, uso e cobrança. Separada da remuneração interna da empresa.',
    planned: ['Plano e ciclo de cobrança do workspace', 'Uso e limites', 'Faturas e histórico de pagamento', 'Upgrade/downgrade de plano'],
  },
  {
    key: 'logs', label: 'Logs', href: '/admin/logs', group: 'observabilidade', icon: Clock,
    tagline: 'Registro técnico de execução do sistema.',
    description: 'A visão técnica de execução — eventos de sistema, erros e integrações — para diagnóstico rápido. Complementa a Auditoria (que é de negócio).',
    planned: ['Logs de execução e integrações', 'Filtro por nível e origem', 'Diagnóstico de erros', 'Retenção configurável'],
  },
]

export function getAdminSection(key: AdminSectionKey): AdminSection | undefined {
  return ADMIN_SECTIONS.find(section => section.key === key)
}
