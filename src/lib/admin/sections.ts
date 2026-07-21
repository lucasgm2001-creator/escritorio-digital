import type { LucideIcon } from 'lucide-react'
import {
  Building2, Users, FolderOpen, Briefcase, Wallet, ShieldCheck,
  Sparkles, ExternalLink, KeyRound, FileText, TrendingUp, Clock, UserPlus, Webhook, Radio, CalendarDays,
} from 'lucide-react'

// Fonte única da estrutura da Administração (Constituição: informação única).
// Isto é só o modelo de navegação/organização — nenhuma regra de negócio.

export type AdminSectionKey =
  | 'empresa' | 'equipe' | 'departamentos' | 'cargos' | 'colaboradores' | 'clientes' | 'agenda' | 'financeiro' | 'remuneracao'
  | 'permissoes' | 'automacoes' | 'integracoes' | 'api' | 'inbound' | 'eventos' | 'auditoria'
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
  // Evolução profissional (PLATFORM-002): contexto, indicadores e estado vazio por módulo.
  context?: string
  metrics?: string[]
  emptyTitle?: string
  emptyHint?: string
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
    planned: [],
    context: 'A Empresa é a raiz do workspace. Tudo — pessoas, regras, integrações — herda a identidade, o fuso e a moeda definidos aqui.',
    metrics: ['Membros', 'Departamentos', 'Integrações'],
    emptyTitle: 'Dados da empresa',
    emptyHint: 'Identidade, cultura, contato e preferências do workspace.',
  },
  {
    key: 'equipe', label: 'Equipe', href: '/admin/equipe', group: 'organizacao', icon: UserPlus,
    tagline: 'Membros, convites e acesso ao workspace.',
    description: 'Quem faz parte do workspace e como entra. Convites por token, papéis e ativação — a porta de entrada multi-tenant do SaaS.',
    planned: ['Lista de membros e papéis', 'Convites por token (gerar, copiar, revogar)', 'Ativação e desligamento de membros', 'Transferência de propriedade'],
    context: 'Equipe governa o ACESSO ao workspace (convites e papéis). As pessoas em si — cargo, gestor, remuneração — vivem em Colaboradores.',
    metrics: ['Membros', 'Convites pendentes', 'Papéis'],
    emptyTitle: 'Gestão de membros em breve',
    emptyHint: 'A criação de convites já existe em Configurações › Equipe; migra para cá nas próximas fases.',
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
    key: 'agenda', label: 'Agendas', href: '/admin/agenda', group: 'organizacao', icon: CalendarDays,
    tagline: 'A agenda de cada colaborador — visão administrativa (só leitura).',
    description: 'Owner e Desenvolvedor enxergam a agenda de qualquer colaborador REUSANDO o calendário existente (calendar_events) — sem duplicar calendário nem criar outro. Escolha a pessoa e veja seus compromissos.',
    planned: ['Lista de colaboradores', 'Agenda individual (só leitura)', 'Reuso do calendário do Hall', 'Filtro por período (futuro)'],
  },
  {
    key: 'clientes', label: 'Clientes', href: '/admin/clientes', group: 'organizacao', icon: Building2,
    tagline: 'A carteira de clientes — cadastro, histórico e workspace por cliente.',
    description: 'A lista de clientes da empresa vive aqui (CLIENT-HISTORY-ADMIN-003): cadastro com histórico completo, prateleiras por nicho e integrações. De cada cliente abre-se o Workspace (financeiro, tráfego, projetos, equipe, agenda, relatórios). Respeita a permissão do módulo — quem tem acesso operacional entra, owner/dev sempre.',
    planned: ['Carteira e prateleiras por nicho', 'Cadastro com histórico automático (lead → contrato → cobrança)', 'Workspace por cliente', 'Integrações e timeline unificada'],
    context: 'Clientes deixou de ser andar principal e passou a viver dentro da Administração. A lista é o ponto de entrada; o Workspace de cada cliente é a operação pós-venda. Datas históricas reconstroem timeline, receita, comissão e relatórios como se o cliente tivesse nascido na época.',
    metrics: ['Clientes ativos', 'Receita mensal', 'Retenção'],
    emptyTitle: 'Nenhum cliente nesta equipe',
    emptyHint: 'Clientes entram automaticamente quando uma venda é fechada no Comercial — ou pelo cadastro histórico.',
  },
  {
    key: 'financeiro', label: 'Financeiro', href: '/admin/financeiro', group: 'regras', icon: TrendingUp,
    tagline: 'Receita recebida, prevista, MRR/ARR, atraso e próximos recebimentos.',
    description: 'Painel financeiro executivo com a MESMA fonte única de Hall/Dashboard/Relatórios (ExecutiveMetricsService). Receita Recebida (client_payments) separada de Valor Fechado (deals); MRR/ARR da carteira ativa; recebimentos pendentes e próximos pela régua de cobrança.',
    planned: [],
    context: 'Todo número vem do ExecutiveMetricsService (fonte única). Receita Recebida ≠ Valor Fechado — dinheiro recebido nunca se mistura com contrato fechado.',
    metrics: ['Receita recebida', 'MRR / ARR', 'Recebimentos pendentes'],
    emptyTitle: 'Sem dados financeiros ainda',
    emptyHint: 'Os números aparecem conforme os pagamentos (client_payments) são registrados.',
  },
  {
    key: 'remuneracao', label: 'Remuneração', href: '/admin/remuneracao', group: 'regras', icon: Wallet,
    tagline: 'Templates de remuneração — configure uma vez, aplique a muitos.',
    description: 'A futura central de remuneração por template: salário, comissões, limites, tetos, aceleradores e vigência — sem escrever código e sem tocar no histórico. Cada pagamento guardará o snapshot da regra usada.',
    planned: ['Templates de remuneração (Closer DR Growth, SDR...)', 'Regras: salário, comissão, limites, tetos, bônus', 'Assignment colaborador → template com vigência', 'Ledger imutável e pagamentos derivados'],
    blueprint: 'compensation',
    context: 'A remuneração é definida por TEMPLATE, aplicada a muitos colaboradores. Mudar o template vale só para o futuro — o histórico nunca recalcula.',
    metrics: ['Templates', 'Colaboradores vinculados', 'Regras ativas'],
    emptyTitle: 'Templates de remuneração em breve',
    emptyHint: 'A engine de cálculo chega no COMPENSATION-001, sobre esta estrutura.',
  },
  {
    key: 'permissoes', label: 'Permissões', href: '/admin/permissoes', group: 'regras', icon: ShieldCheck,
    tagline: 'Quem vê, configura, aprova e consulta — por módulo.',
    description: 'A matriz definitiva de permissões (Owner, Admin, Manager, Member) por módulo. A segurança viverá no servidor e no banco (RLS), nunca apenas escondendo botões.',
    planned: ['Papéis: Owner, Admin, Manager, Member', 'Matriz por módulo: ver / configurar / aprovar / consultar', 'Escopo por equipe e workspace', 'Reflexo em RLS (não só na interface)'],
    context: 'Permissão ≠ Cargo. O acesso vem do papel na equipe (Owner/Admin/Manager/Member), aplicado no servidor e no banco (RLS) — nunca só escondendo botões.',
    metrics: ['Papéis', 'Módulos', 'Regras'],
    emptyTitle: 'Matriz de permissões em breve',
    emptyHint: 'Ver / configurar / aprovar / consultar, por módulo.',
  },
  {
    key: 'automacoes', label: 'Automações', href: '/admin/automacoes', group: 'regras', icon: Sparkles,
    tagline: "Regras 'SE evento ENTÃO ação' — trabalho que se faz sozinho.",
    description: 'A área que transforma acontecimentos em automação declarativa. Preparada para o motor de eventos e automações — sem lógica embutida em código.',
    planned: ['Regras declarativas orientadas a eventos', 'Gatilhos: venda, pagamento, upgrade, meta...', 'Ações: liberar comissão, notificar, agendar follow-up', 'Histórico e status de cada automação'],
    context: 'Automação é regra declarativa "SE evento ENTÃO ação". Consome os eventos do sistema — sem lógica escondida em código.',
    metrics: ['Automações', 'Gatilhos', 'Execuções'],
    emptyTitle: 'Automações em breve',
    emptyHint: 'Requer o motor de eventos (EVENTS-001).',
  },
  {
    key: 'integracoes', label: 'Integrações', href: '/admin/integracoes', group: 'plataforma', icon: ExternalLink,
    tagline: 'Fontes externas do workspace, coexistindo com o que já roda.',
    description: 'O centro de integrações por workspace (Meta, Google, WhatsApp, Make e mais). Tudo construído ao lado do que já existe — nunca reescrevendo as integrações atuais.',
    planned: ['Conectar fontes por workspace', 'Status e saúde de cada integração', 'Credenciais escopadas por equipe', 'Coexistência com Magnetic/Meta/Make/webhooks'],
    context: 'Cada workspace conecta suas próprias fontes. Tudo coexiste com as integrações atuais (Magnetic/Meta/Make/webhooks) — nunca as reescreve (INT-001).',
    metrics: ['Conectadas', 'Disponíveis', 'Eventos recebidos'],
    emptyTitle: 'Centro de integrações em breve',
    emptyHint: 'Meta, Google, WhatsApp e APIs, escopados por equipe.',
  },
  {
    key: 'api', label: 'API', href: '/admin/api', group: 'plataforma', icon: KeyRound,
    tagline: 'Chaves de API e webhooks escopados por workspace.',
    description: 'A superfície de plataforma para terceiros: chaves, secrets e webhooks — sempre escopados por workspace e por permissão. Base do futuro ecossistema.',
    planned: ['Chaves de API por workspace', 'Webhooks de saída', 'Escopos e rotação de segredos', 'Registro de uso'],
    context: 'A superfície de plataforma para terceiros. Chaves e webhooks sempre escopados por workspace e por permissão.',
    metrics: ['Chaves ativas', 'Webhooks', 'Requisições'],
    emptyTitle: 'Chaves e webhooks em breve',
    emptyHint: 'Base do futuro ecossistema e SDK.',
  },
  {
    key: 'inbound', label: 'Webhooks de Entrada', href: '/admin/inbound', group: 'plataforma', icon: Webhook,
    tagline: 'A porta de entrada — leads e eventos de ferramentas externas.',
    description: 'A Central de API de ENTRADA: recebe leads e eventos de Magnetic, Meta Lead Ads, formulários, WhatsApp e automações (Make/n8n/Zapier). Estrutura provider-agnostic pronta; nada ativo até autorização, chave e mapeamento.',
    planned: ['Providers de entrada preparados', 'Webhook seguro por token (HMAC, replay protection)', 'Normalização payload externo → lead', 'Logs de entrega, eventos e replay'],
    context: 'A porta de entrada do workspace. Coexiste com o webhook Magnetic atual (/api/leads/inbound), generalizando-o — nunca o reescreve (INT-001).',
    metrics: ['Providers', 'Endpoints ativos', 'Entregas 24h'],
    emptyTitle: 'Webhooks de entrada preparados',
    emptyHint: 'Ative um provider com autorização, chave e mapeamento.',
  },
  {
    key: 'eventos', label: 'Eventos', href: '/admin/eventos', group: 'plataforma', icon: Radio,
    tagline: 'O barramento de eventos — como os módulos conversam.',
    description: 'O Event Bus do Escritório Digital: catálogo de eventos de domínio (lead/tarefa/cliente/pagamento/integração...) que conecta Timeline, Dashboard, IA, Billing, Inbound e Notificações — sem acoplar os módulos. Arquitetura preparada; nenhum evento publicado.',
    planned: ['Catálogo único de eventos de domínio', 'Publisher / Subscriber / Dispatcher', 'Event log com status e replay', 'Timeline e automações orientadas a evento'],
    context: 'O barramento provider-agnostic. Cada módulo publica/assina eventos sem conhecer os outros — a fundação de automações e da Timeline unificada.',
    metrics: ['Eventos no catálogo', 'Publishers', 'Eventos 24h'],
    emptyTitle: 'Barramento de eventos preparado',
    emptyHint: 'Catálogo pronto; nenhum publisher/subscriber ativo ainda.',
  },
  {
    key: 'auditoria', label: 'Auditoria', href: '/admin/auditoria', group: 'observabilidade', icon: FileText,
    tagline: 'Trilha imutável de quem fez o quê.',
    description: 'O registro de negócio imutável: quem fez, o quê e quando. Histórico que nunca é editado nem apagado — a memória confiável do workspace.',
    planned: ['Trilha de ações por usuário', 'Filtro por módulo, pessoa e período', 'Registros imutáveis (append-only)', 'Exportação para conformidade'],
    context: 'Registro de NEGÓCIO imutável (quem fez o quê). Append-only: nunca editado nem apagado.',
    metrics: ['Eventos', 'Usuários', 'Retenção'],
    emptyTitle: 'Trilha de auditoria em breve',
    emptyHint: 'Filtros por módulo, pessoa e período.',
  },
  {
    key: 'billing', label: 'Billing', href: '/admin/billing', group: 'plataforma', icon: TrendingUp,
    tagline: 'A assinatura do workspace no SaaS.',
    description: 'A relação comercial do Escritório Digital com este workspace: plano, uso e cobrança. Separada da remuneração interna da empresa.',
    planned: ['Plano e ciclo de cobrança do workspace', 'Uso e limites', 'Faturas e histórico de pagamento', 'Upgrade/downgrade de plano'],
    context: 'A assinatura do workspace no SaaS — separada da remuneração interna da empresa.',
    metrics: ['Plano', 'Uso', 'Próxima fatura'],
    emptyTitle: 'Assinatura e cobrança em breve',
    emptyHint: 'Plano, uso, faturas e upgrades.',
  },
  {
    key: 'logs', label: 'Logs', href: '/admin/logs', group: 'observabilidade', icon: Clock,
    tagline: 'Registro técnico de execução do sistema.',
    description: 'A visão técnica de execução — eventos de sistema, erros e integrações — para diagnóstico rápido. Complementa a Auditoria (que é de negócio).',
    planned: ['Logs de execução e integrações', 'Filtro por nível e origem', 'Diagnóstico de erros', 'Retenção configurável'],
    context: 'Visão TÉCNICA de execução (erros, integrações) para diagnóstico. Complementa a Auditoria, que é de negócio.',
    metrics: ['Erros 24h', 'Requisições', 'Integrações'],
    emptyTitle: 'Logs técnicos em breve',
    emptyHint: 'Filtro por nível e origem; retenção configurável.',
  },
]

export function getAdminSection(key: AdminSectionKey): AdminSection | undefined {
  return ADMIN_SECTIONS.find(section => section.key === key)
}
