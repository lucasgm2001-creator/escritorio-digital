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

// Tipo de META padrão do cargo (PERSONAL-WORK-001). Só sugestão — a meta REAL é por colaborador.
export type GoalType = 'reunioes' | 'vendas' | 'time' | 'performance' | 'retencao' | 'entregas' | 'nenhuma'

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
  goalType: GoalType                 // tipo de meta padrão (PERSONAL-WORK-001)
}

// Catálogo OFICIAL de cargos (PEOPLE-001, expandido em COLLABORATORS-REAL-001/PERSONAL-WORK-001). NÃO é seed:
// é o catálogo profissional reutilizável. Cada cargo declara departamento, nível, ícone, cor, permissão padrão
// (defaultTeamRole), remuneração padrão (defaultComp), se entra em comissão e o tipo de meta padrão.
export const ROLE_CATALOG: RoleBlueprint[] = [
  // ── Direção / Gestão ──
  { key: 'owner',               name: 'Owner',               description: 'Dono do workspace; controla tudo.',                department: 'direcao',       level: 'direcao', icon: 'Crown',        color: '#EAB308', defaultTeamRole: 'owner',  defaultComp: 'livre',         commission: false, goalType: 'nenhuma'    },
  { key: 'administrador',       name: 'Administrador',       description: 'Administra pessoas, acessos e configurações.',      department: 'direcao',       level: 'direcao', icon: 'ShieldCheck',  color: '#60A5FA', defaultTeamRole: 'admin',  defaultComp: 'fixo',          commission: false, goalType: 'nenhuma'    },
  { key: 'diretor',             name: 'Diretor',             description: 'Direção executiva de uma área ou do workspace.',    department: 'direcao',       level: 'direcao', icon: 'Crown',        color: '#EAB308', defaultTeamRole: 'admin',  defaultComp: 'fixo_bonus',    commission: false, goalType: 'time'       },
  { key: 'gerente',             name: 'Gerente',             description: 'Gerencia uma área e sua equipe.',                   department: 'direcao',       level: 'gestao',  icon: 'Briefcase',    color: '#EAB308', defaultTeamRole: 'admin',  defaultComp: 'fixo_bonus',    commission: false, goalType: 'time'       },
  { key: 'coordenador',         name: 'Coordenador',         description: 'Coordena rotinas e pessoas de uma área.',           department: 'direcao',       level: 'gestao',  icon: 'Compass',      color: '#EAB308', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: false, goalType: 'time'       },
  // ── Comercial ──
  { key: 'head_comercial',      name: 'Head Comercial',      description: 'Lidera toda a operação comercial e a estratégia.',  department: 'comercial',     level: 'gestao',  icon: 'Trophy',       color: '#C2F73A', defaultTeamRole: 'admin',  defaultComp: 'fixo_bonus',    commission: true,  goalType: 'time'       },
  { key: 'gerente_comercial',   name: 'Gerente Comercial',   description: 'Lidera o time comercial e as metas de vendas.',     department: 'comercial',     level: 'gestao',  icon: 'Trophy',       color: '#C2F73A', defaultTeamRole: 'admin',  defaultComp: 'fixo_bonus',    commission: true,  goalType: 'time'       },
  { key: 'supervisor_comercial',name: 'Supervisor Comercial',description: 'Acompanha closers/SDRs no dia a dia.',              department: 'comercial',     level: 'gestao',  icon: 'Users',        color: '#C2F73A', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true,  goalType: 'time'       },
  { key: 'closer',              name: 'Closer',              description: 'Conduz e fecha as vendas.',                         department: 'comercial',     level: 'senior',  icon: 'Handshake',    color: '#C2F73A', defaultTeamRole: 'member', defaultComp: 'fixo_comissao', commission: true,  goalType: 'vendas'     },
  { key: 'sdr',                 name: 'SDR',                 description: 'Qualifica e agenda oportunidades.',                 department: 'comercial',     level: 'pleno',   icon: 'PhoneCall',    color: '#C2F73A', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true,  goalType: 'reunioes'   },
  { key: 'pre_vendas',          name: 'Pré-vendas',          description: 'Primeiro contato e triagem de leads.',              department: 'comercial',     level: 'junior',  icon: 'UserPlus',     color: '#C2F73A', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true,  goalType: 'reunioes'   },
  { key: 'pos_vendas',          name: 'Pós-vendas',          description: 'Onboarding e continuidade após a venda.',           department: 'atendimento',   level: 'pleno',   icon: 'CheckCheck',   color: '#F472B6', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'retencao'   },
  // ── Tráfego / Marketing ──
  { key: 'gestor_trafego',      name: 'Gestor de Tráfego',   description: 'Mídia paga, otimização e performance.',             department: 'trafego',       level: 'senior',  icon: 'Target',       color: '#38BDF8', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true,  goalType: 'performance'},
  { key: 'analista_trafego',    name: 'Analista de Tráfego', description: 'Analisa campanhas, métricas e otimizações.',        department: 'trafego',       level: 'pleno',   icon: 'LineChart',    color: '#38BDF8', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: false, goalType: 'performance'},
  { key: 'especialista_google', name: 'Especialista Google Ads', description: 'Especialista em campanhas Google Ads.',         department: 'trafego',       level: 'senior',  icon: 'Search',       color: '#38BDF8', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: false, goalType: 'performance'},
  { key: 'especialista_meta',   name: 'Especialista Meta Ads',   description: 'Especialista em campanhas Meta (Facebook/Instagram).', department: 'trafego',    level: 'senior',  icon: 'Megaphone',    color: '#38BDF8', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: false, goalType: 'performance'},
  { key: 'designer',            name: 'Designer',            description: 'Cria peças e experiências visuais.',                department: 'marketing',     level: 'pleno',   icon: 'PenTool',      color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'motion_designer',     name: 'Motion Designer',     description: 'Animações e vídeos com movimento.',                 department: 'marketing',     level: 'pleno',   icon: 'Film',         color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'criador_criativos',   name: 'Criador de Criativos',description: 'Produz criativos de anúncio de alta conversão.',    department: 'marketing',     level: 'pleno',   icon: 'Sparkles',     color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: false, goalType: 'entregas'   },
  { key: 'social_media',        name: 'Social Media',        description: 'Gestão de redes e comunidade.',                     department: 'marketing',     level: 'pleno',   icon: 'Share2',       color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'copywriter',          name: 'Copywriter',          description: 'Escreve textos de venda e conteúdo.',               department: 'marketing',     level: 'pleno',   icon: 'Type',         color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'editor',              name: 'Editor de Vídeo',     description: 'Edição de vídeo e materiais.',                      department: 'marketing',     level: 'pleno',   icon: 'Clapperboard', color: '#A855F7', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  // ── Administrativo / Atendimento / CS ──
  { key: 'financeiro',          name: 'Financeiro',          description: 'Receita, pagamentos e conciliação.',                department: 'financeiro',    level: 'pleno',   icon: 'Wallet',       color: '#22C55E', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'nenhuma'    },
  { key: 'administrativo',      name: 'Administrativo',      description: 'Rotinas administrativas e apoio.',                  department: 'administrativo',level: 'pleno',   icon: 'ClipboardList',color: '#94A3B8', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'nenhuma'    },
  { key: 'rh',                  name: 'RH',                  description: 'Pessoas, cultura e processos de gente.',            department: 'administrativo',level: 'pleno',   icon: 'Users',        color: '#94A3B8', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'nenhuma'    },
  { key: 'atendimento',         name: 'Atendimento',         description: 'Primeiro atendimento e relacionamento.',            department: 'atendimento',   level: 'junior',  icon: 'MessageCircle',color: '#F472B6', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'retencao'   },
  { key: 'suporte',             name: 'Suporte',             description: 'Atendimento e resolução de chamados.',              department: 'atendimento',   level: 'junior',  icon: 'Headset',      color: '#F472B6', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'customer_success',    name: 'Sucesso do Cliente',  description: 'Retenção, expansão e saúde do cliente.',            department: 'cs',            level: 'senior',  icon: 'HeartHandshake',color: '#34D399', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: true,  goalType: 'retencao'   },
  // ── Operações ──
  { key: 'operacoes',           name: 'Operações',           description: 'Processos, entrega e eficiência.',                  department: 'operacoes',     level: 'pleno',   icon: 'Cog',          color: '#F59E0B', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'gerente_operacional', name: 'Gerente Operacional', description: 'Lidera a operação e a eficiência do time.',         department: 'operacoes',     level: 'gestao',  icon: 'Cog',          color: '#F59E0B', defaultTeamRole: 'admin',  defaultComp: 'fixo_bonus',    commission: false, goalType: 'time'       },
  // ── Tecnologia ──
  { key: 'desenvolvedor',       name: 'Desenvolvedor',       description: 'Desenvolve e mantém o produto.',                    department: 'tecnologia',    level: 'pleno',   icon: 'Code',         color: '#60A5FA', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'dev_fullstack',       name: 'Desenvolvedor Full Stack', description: 'Front-end e back-end do produto.',             department: 'tecnologia',    level: 'senior',  icon: 'Code2',        color: '#60A5FA', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'qa',                  name: 'QA',                  description: 'Qualidade, testes e confiabilidade.',              department: 'tecnologia',    level: 'pleno',   icon: 'Bug',          color: '#60A5FA', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'devops',              name: 'DevOps',              description: 'Infraestrutura, deploy e observabilidade.',         department: 'tecnologia',    level: 'senior',  icon: 'Server',       color: '#60A5FA', defaultTeamRole: 'member', defaultComp: 'fixo',          commission: false, goalType: 'entregas'   },
  { key: 'product_manager',     name: 'Product Manager',     description: 'Descoberta, roadmap e priorização do produto.',     department: 'tecnologia',    level: 'gestao',  icon: 'Compass',      color: '#60A5FA', defaultTeamRole: 'member', defaultComp: 'fixo_bonus',    commission: false, goalType: 'entregas'   },
]

export const ROLE_LEVEL_LABEL: Record<RoleLevel, string> = {
  direcao: 'Direção', gestao: 'Gestão', senior: 'Sênior', pleno: 'Pleno', junior: 'Júnior',
}

export const COMP_MODEL_LABEL: Record<CompModel, string> = {
  livre: 'Livre', fixo: 'Fixo', fixo_comissao: 'Fixo + comissão', fixo_bonus: 'Fixo + bônus', comissao: 'Comissão',
}

export const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  reunioes: 'Reuniões marcadas', vendas: 'Vendas', time: 'Meta de equipe', performance: 'Performance',
  retencao: 'Retenção', entregas: 'Entregas', nenhuma: 'Sem meta',
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
