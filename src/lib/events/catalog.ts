import type { EventCategory, EventPriority, EventType } from './types'

// Catálogo ÚNICO de eventos (EVENT-001, Parts 3/4). Só metadados — nenhum evento é publicado. Cada definição
// declara categoria, prioridade, descrição, módulo de ORIGEM e módulos de DESTINO interessados (documental).
export type EventDefinition = {
  type: EventType
  category: EventCategory
  priority: EventPriority
  description: string
  source: string
  targets: string[]
}

export const EVENT_CATALOG: EventDefinition[] = [
  // ── Lead / Comercial ──
  { type: 'lead.created',   category: 'lead', priority: 'normal', description: 'Um lead entrou no funil (manual ou por webhook de entrada).', source: 'Comercial', targets: ['Timeline', 'Dashboard', 'IA', 'Notificações'] },
  { type: 'lead.updated',   category: 'lead', priority: 'low',    description: 'Dados de um lead foram alterados.', source: 'Comercial', targets: ['Timeline', 'Dashboard'] },
  { type: 'lead.deleted',   category: 'lead', priority: 'low',    description: 'Um lead foi removido do funil.', source: 'Comercial', targets: ['Timeline', 'Dashboard'] },
  { type: 'lead.moved',     category: 'lead', priority: 'normal', description: 'Um lead mudou de etapa do funil.', source: 'Comercial', targets: ['Timeline', 'Dashboard', 'IA'] },

  // ── Tarefas ──
  { type: 'task.created',   category: 'task', priority: 'low',    description: 'Uma tarefa foi criada.', source: 'Tarefas', targets: ['Timeline', 'Notificações'] },
  { type: 'task.completed', category: 'task', priority: 'normal', description: 'Uma tarefa foi concluída.', source: 'Tarefas', targets: ['Timeline', 'Dashboard'] },
  { type: 'task.deleted',   category: 'task', priority: 'low',    description: 'Uma tarefa foi excluída.', source: 'Tarefas', targets: ['Timeline'] },

  // ── Reuniões ──
  { type: 'meeting.created',   category: 'meeting', priority: 'normal', description: 'Uma reunião foi agendada.', source: 'Agenda', targets: ['Timeline', 'Notificações'] },
  { type: 'meeting.completed', category: 'meeting', priority: 'normal', description: 'Uma reunião foi realizada.', source: 'Agenda', targets: ['Timeline', 'Dashboard', 'Comercial'] },

  // ── Clientes ──
  { type: 'client.created', category: 'client', priority: 'normal', description: 'Um lead virou cliente (venda fechada).', source: 'Clientes', targets: ['Timeline', 'Dashboard', 'Billing', 'IA'] },
  { type: 'client.updated', category: 'client', priority: 'low',    description: 'Dados de um cliente foram alterados.', source: 'Clientes', targets: ['Timeline'] },

  // ── Pagamentos / Billing ──
  { type: 'payment.confirmed', category: 'payment', priority: 'high',     description: 'Um pagamento foi confirmado.', source: 'Billing', targets: ['Timeline', 'Dashboard', 'Comercial', 'Notificações'] },
  { type: 'payment.failed',    category: 'payment', priority: 'critical', description: 'Um pagamento falhou.', source: 'Billing', targets: ['Timeline', 'Notificações', 'IA'] },
  { type: 'payment.refunded',  category: 'payment', priority: 'high',     description: 'Um pagamento foi estornado.', source: 'Billing', targets: ['Timeline', 'Dashboard', 'Notificações'] },

  // ── Integrações / Webhooks ──
  { type: 'integration.connected', category: 'integration', priority: 'normal',   description: 'Uma integração foi conectada.', source: 'Integrações', targets: ['Timeline', 'Notificações'] },
  { type: 'integration.failed',    category: 'integration', priority: 'high',     description: 'Uma integração falhou/expirou.', source: 'Integrações', targets: ['Timeline', 'Notificações'] },
  { type: 'webhook.received',      category: 'webhook',     priority: 'normal',   description: 'Um webhook de entrada foi recebido.', source: 'Inbound', targets: ['Comercial', 'Timeline', 'IA'] },

  // ── Relatórios / Notificações / IA ──
  { type: 'report.generated',    category: 'report',       priority: 'low',    description: 'Um relatório (PDF/exportação) foi gerado.', source: 'Relatórios', targets: ['Timeline', 'Notificações'] },
  { type: 'notification.created', category: 'notification', priority: 'normal', description: 'Uma notificação foi criada para um usuário.', source: 'Notificações', targets: ['Timeline'] },
  { type: 'ai.summary.created',   category: 'ai',           priority: 'low',    description: 'A IA gerou um resumo/briefing.', source: 'IA', targets: ['Timeline', 'Dashboard'] },

  // ── Workspace / Equipe (auditoria — TEAM-ADMIN-002, Part 7; só contrato, nada é publicado ainda) ──
  { type: 'workspace.member_promoted',   category: 'workspace', priority: 'normal', description: 'Um membro foi promovido (member → admin).', source: 'Workspace', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'workspace.member_demoted',    category: 'workspace', priority: 'normal', description: 'Um membro foi rebaixado (admin → member).', source: 'Workspace', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'workspace.owner_transferred', category: 'workspace', priority: 'high',   description: 'A propriedade (ownership) da equipe foi transferida.', source: 'Workspace', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'workspace.invite_accepted',   category: 'workspace', priority: 'normal', description: 'Um convite foi aceito e um novo membro entrou.', source: 'Workspace', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'workspace.invite_revoked',    category: 'workspace', priority: 'low',    description: 'Um convite pendente foi revogado.', source: 'Workspace', targets: ['Auditoria', 'Timeline'] },
  { type: 'workspace.member_removed',    category: 'workspace', priority: 'high',   description: 'Um membro foi removido da equipe.', source: 'Workspace', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'workspace.created',           category: 'workspace', priority: 'normal', description: 'Uma nova equipe (workspace) foi criada.', source: 'Workspace', targets: ['Auditoria', 'Timeline'] },
  { type: 'workspace.left',              category: 'workspace', priority: 'normal', description: 'Um usuário saiu da equipe (com sucessão de owner quando aplicável).', source: 'Workspace', targets: ['Auditoria', 'Notificações', 'Timeline'] },

  // ── Colaboradores / RH (ciclo de vida — PEOPLE-001, Part 8; só contrato, nada publicado ainda) ──
  { type: 'employee.created',             category: 'people', priority: 'normal', description: 'Um colaborador foi cadastrado.', source: 'Colaboradores', targets: ['Auditoria', 'Timeline', 'Notificações'] },
  { type: 'employee.updated',             category: 'people', priority: 'low',    description: 'Dados de um colaborador foram alterados.', source: 'Colaboradores', targets: ['Auditoria', 'Timeline'] },
  { type: 'employee.promoted',            category: 'people', priority: 'normal', description: 'Um colaborador foi promovido.', source: 'Colaboradores', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'employee.department.changed',  category: 'people', priority: 'normal', description: 'Um colaborador mudou de departamento.', source: 'Colaboradores', targets: ['Auditoria', 'Timeline'] },
  { type: 'employee.role.changed',        category: 'people', priority: 'normal', description: 'O cargo/função de um colaborador mudou.', source: 'Colaboradores', targets: ['Auditoria', 'Timeline'] },
  { type: 'employee.permissions.changed', category: 'people', priority: 'high',   description: 'As permissões de um colaborador foram alteradas.', source: 'Colaboradores', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'employee.salary.changed',      category: 'people', priority: 'high',   description: 'A remuneração de um colaborador foi alterada (vigência futura; histórico não recalcula).', source: 'Colaboradores', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'employee.goal.changed',        category: 'people', priority: 'normal', description: 'Uma meta de um colaborador foi definida/alterada.', source: 'Colaboradores', targets: ['Auditoria', 'Timeline'] },
  { type: 'employee.archived',            category: 'people', priority: 'normal', description: 'Um colaborador foi arquivado/desativado.', source: 'Colaboradores', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  // Ciclo de vida nomeado (COLLABORATORS-REAL-001, Part 7; só contrato — nada é publicado ainda).
  { type: 'employee.hired',               category: 'people', priority: 'normal', description: 'Um colaborador foi contratado / entrou na equipe.', source: 'Colaboradores', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'employee.manager.changed',     category: 'people', priority: 'normal', description: 'O gestor (líder direto) de um colaborador mudou.', source: 'Colaboradores', targets: ['Auditoria', 'Timeline'] },
  { type: 'employee.compensation.changed',category: 'people', priority: 'high',   description: 'A remuneração de um colaborador mudou (vigência futura; histórico não recalcula).', source: 'Colaboradores', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  // Permissões granulares por módulo (PEOPLE-002, Part 8; só contrato).
  { type: 'employee.permission.changed',   category: 'people', priority: 'high', description: 'As permissões de um colaborador mudaram (visão geral).', source: 'Colaboradores', targets: ['Auditoria', 'Notificações', 'Timeline'] },
  { type: 'employee.module.granted',       category: 'people', priority: 'high', description: 'Acesso a um módulo foi concedido a um colaborador.', source: 'Colaboradores', targets: ['Auditoria', 'Timeline'] },
  { type: 'employee.module.revoked',       category: 'people', priority: 'high', description: 'Acesso a um módulo foi revogado de um colaborador.', source: 'Colaboradores', targets: ['Auditoria', 'Timeline'] },
  { type: 'employee.module.level.changed', category: 'people', priority: 'high', description: 'O nível de acesso a um módulo mudou (sem acesso/leitura/editar/admin).', source: 'Colaboradores', targets: ['Auditoria', 'Timeline'] },
]

export const EVENT_CATEGORIES: { key: EventCategory; label: string }[] = [
  { key: 'lead', label: 'Leads' },
  { key: 'task', label: 'Tarefas' },
  { key: 'meeting', label: 'Reuniões' },
  { key: 'client', label: 'Clientes' },
  { key: 'payment', label: 'Pagamentos' },
  { key: 'integration', label: 'Integrações' },
  { key: 'webhook', label: 'Webhooks' },
  { key: 'report', label: 'Relatórios' },
  { key: 'notification', label: 'Notificações' },
  { key: 'ai', label: 'IA' },
  { key: 'system', label: 'Sistema' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'people', label: 'Colaboradores' },
]

export function eventsByCategory(category: EventCategory): EventDefinition[] {
  return EVENT_CATALOG.filter(e => e.category === category)
}

export function getEventDefinition(type: string): EventDefinition | undefined {
  return EVENT_CATALOG.find(e => e.type === type)
}
