// Catálogo PROFISSIONAL de departamentos e cargos (PEOPLE-001, Parts 3/4). Arquitetura ESTÁTICA — sem tabela,
// sem persistência, sem regra de negócio. Reutilizável: escolher cargo/depto ao configurar um colaborador,
// sugerir papel de acesso (owner/admin/member) e o tipo de remuneração padrão. Ícone é o NOME lucide (string)
// — nada de JSX aqui, para o módulo ser importável no server e no client. Multi-tenant: aplica-se a qualquer
// equipe (o catálogo é o mesmo; o vínculo colaborador↔cargo é por equipe no domínio de Pessoas).

// ── Departamentos (Part 4) ──────────────────────────────────────────────────────────────────────────
export type DepartmentKey =
  | 'comercial' | 'marketing' | 'trafego' | 'financeiro' | 'administrativo'
  | 'operacoes' | 'tecnologia' | 'atendimento' | 'cs' | 'direcao'

export type DepartmentBlueprint = {
  key: DepartmentKey
  name: string
  description: string
  icon: string     // nome do ícone lucide (a UI resolve)
  color: string    // hex do badge/realce
}

export const DEPARTMENT_CATALOG: DepartmentBlueprint[] = [
  { key: 'comercial',      name: 'Comercial',        description: 'Aquisição, funil e fechamento de vendas.', icon: 'Briefcase',      color: '#C2F73A' },
  { key: 'marketing',      name: 'Marketing',        description: 'Conteúdo, campanhas e geração de demanda.', icon: 'Megaphone',      color: '#A855F7' },
  { key: 'trafego',        name: 'Tráfego',          description: 'Mídia paga, otimização e performance.',     icon: 'Target',         color: '#38BDF8' },
  { key: 'financeiro',     name: 'Financeiro',       description: 'Receita, pagamentos e controle financeiro.', icon: 'Wallet',        color: '#22C55E' },
  { key: 'administrativo', name: 'Administrativo',   description: 'Rotinas administrativas e suporte interno.', icon: 'ClipboardList', color: '#94A3B8' },
  { key: 'operacoes',      name: 'Operações',        description: 'Entrega, processos e eficiência operacional.', icon: 'Cog',         color: '#F59E0B' },
  { key: 'tecnologia',     name: 'Tecnologia',       description: 'Produto, engenharia e infraestrutura.',    icon: 'Code',           color: '#60A5FA' },
  { key: 'atendimento',    name: 'Atendimento',      description: 'Suporte e relacionamento pós-venda.',      icon: 'Headset',        color: '#F472B6' },
  { key: 'cs',             name: 'Customer Success', description: 'Retenção, expansão e sucesso do cliente.', icon: 'HeartHandshake', color: '#34D399' },
  { key: 'direcao',        name: 'Direção',          description: 'Liderança e administração do workspace.',   icon: 'Crown',          color: '#EAB308' },
]

// ── Cargos (Part 3) ─────────────────────────────────────────────────────────────────────────────────
export type RoleLevel = 'direcao' | 'gestao' | 'senior' | 'pleno' | 'junior'

// Modelo de remuneração PADRÃO do cargo (só sugestão; a remuneração REAL vem do template/override — Part 6,
// Compensation Engine). Não é cálculo nem persistência.
export type CompModel = 'livre' | 'fixo' | 'fixo_comissao' | 'fixo_bonus' | 'comissao'

// Papel de ACESSO padrão no workspace (TEAM-001). É a FONTE das "permissões padrão" do cargo (Part 7): as
// permissões efetivas são derivadas deste papel via can.ts, sem duplicar listas de permissão no catálogo.
export type TeamRoleDefault = 'owner' | 'admin' | 'member'

export type RoleBlueprint = {
  key: string
  name: string
  description: string
  department: DepartmentKey
  level: RoleLevel
  icon: string
  color: string
  defaultTeamRole: TeamRoleDefault   // permissões padrão derivam daqui (Part 7)
  defaultComp: CompModel             // tipo de remuneração padrão (Part 6)
  commission: boolean                // participa de comissão?
}

export const ROLE_CATALOG: RoleBlueprint[] = [
  { key: 'owner',               name: 'Owner',               description: 'Dono do workspace; controla tudo.',                department: 'direcao',       level: 'direcao', icon: 'Crown',        color: '#EAB308', defaultTeamRole: 'owner',  defaultComp: 'livre',         commission: false },
  { key: 'administrador',       name: 'Administrador',       description: 'Administra pessoas, acessos e configurações.',      department: 'direcao',       level: 'direcao', icon: 'ShieldCheck',  color: '#60A5FA', defaultTeamRole: 'admin',  defaultComp: 'fixo',          commission: false },
  { key: 'gerente_comercial',   name: 'Gerente Comercial',   description: 'Lidera o time comercial e as metas de vendas.',     department: 'comercial',     level: 'gestao',  icon: 'Trophy',       color: '#C2F73A', defaultTeamRole: 'admin',  defaultComp: 'fixo_bonus',    commission: true  },
  { key: 'supervisor_comercial',name: 'Supervisor Comercial',description: 'Acompanha closers/SDRs no dia a dia.',              department: 'comercial',     level: 'gestao',  icon: 'Users',        color: '#C2F73A', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true  },
  { key: 'closer',              name: 'Closer',              description: 'Conduz e fecha as vendas.',                         department: 'comercial',     level: 'senior',  icon: 'Handshake',    color: '#C2F73A', defaultTeamRole: 'member', defaultComp: 'fixo_comissao', commission: true  },
  { key: 'sdr',                 name: 'SDR',                 description: 'Qualifica e agenda oportunidades.',                 department: 'comercial',     level: 'pleno',   icon: 'PhoneCall',    color: '#C2F73A', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true  },
  { key: 'pre_vendas',          name: 'Pré-vendas',          description: 'Primeiro contato e triagem de leads.',              department: 'comercial',     level: 'junior',  icon: 'UserPlus',     color: '#C2F73A', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true  },
  { key: 'pos_vendas',          name: 'Pós-vendas',          description: 'Onboarding e continuidade após a venda.',           department: 'atendimento',   level: 'pleno',   icon: 'CheckCheck',   color: '#F472B6', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false },
  { key: 'gestor_trafego',      name: 'Gestor de Tráfego',   description: 'Mídia paga, otimização e performance.',             department: 'trafego',       level: 'senior',  icon: 'Target',       color: '#38BDF8', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true  },
  { key: 'designer',            name: 'Designer',            description: 'Cria peças e experiências visuais.',                department: 'marketing',     level: 'pleno',   icon: 'PenTool',      color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false },
  { key: 'social_media',        name: 'Social Media',        description: 'Gestão de redes e comunidade.',                     department: 'marketing',     level: 'pleno',   icon: 'Share2',       color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false },
  { key: 'copywriter',          name: 'Copywriter',          description: 'Escreve textos de venda e conteúdo.',               department: 'marketing',     level: 'pleno',   icon: 'Type',         color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false },
  { key: 'editor',              name: 'Editor',              description: 'Edição de vídeo e materiais.',                      department: 'marketing',     level: 'pleno',   icon: 'Clapperboard', color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false },
  { key: 'financeiro',          name: 'Financeiro',          description: 'Receita, pagamentos e conciliação.',                department: 'financeiro',    level: 'pleno',   icon: 'Wallet',       color: '#22C55E', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false },
  { key: 'administrativo',      name: 'Administrativo',      description: 'Rotinas administrativas e apoio.',                  department: 'administrativo',level: 'pleno',   icon: 'ClipboardList',color: '#94A3B8', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false },
  { key: 'suporte',             name: 'Suporte',             description: 'Atendimento e resolução de chamados.',              department: 'atendimento',   level: 'junior',  icon: 'Headset',      color: '#F472B6', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false },
  { key: 'customer_success',    name: 'Customer Success',    description: 'Retenção, expansão e saúde do cliente.',            department: 'cs',            level: 'senior',  icon: 'HeartHandshake',color: '#34D399', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true  },
  { key: 'operacoes',           name: 'Operações',           description: 'Processos, entrega e eficiência.',                  department: 'operacoes',     level: 'pleno',   icon: 'Cog',          color: '#F59E0B', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false },
]

export const ROLE_LEVEL_LABEL: Record<RoleLevel, string> = {
  direcao: 'Direção', gestao: 'Gestão', senior: 'Sênior', pleno: 'Pleno', junior: 'Júnior',
}

export const COMP_MODEL_LABEL: Record<CompModel, string> = {
  livre: 'Livre', fixo: 'Fixo', fixo_comissao: 'Fixo + comissão', fixo_bonus: 'Fixo + bônus', comissao: 'Comissão',
}

// Helpers puros (sem I/O) — a UI e o domínio leem daqui.
export function roleByKey(key: string): RoleBlueprint | undefined {
  return ROLE_CATALOG.find(r => r.key === key)
}
export function departmentByKey(key: DepartmentKey): DepartmentBlueprint | undefined {
  return DEPARTMENT_CATALOG.find(d => d.key === key)
}
export function rolesByDepartment(department: DepartmentKey): RoleBlueprint[] {
  return ROLE_CATALOG.filter(r => r.department === department)
}
