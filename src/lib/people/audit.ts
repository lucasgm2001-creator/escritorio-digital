import type { EventType } from '@/lib/events/types'

// Contratos de AUDITORIA do domínio Pessoas (PEOPLE-001, Part 9). SÓ contratos — NADA é persistido. Toda
// mudança relevante em um colaborador (cargo, departamento, permissões, remuneração, meta, status) gera uma
// entrada IMUTÁVEL: quem fez, quando, o que mudou (antes→depois), de onde. Liga-se aos eventos employee.*
// (Part 8). Quando o runtime de auditoria existir, é isto que será gravado — sem retrabalho.

export type PeopleAuditAction =
  | 'employee.created'
  | 'employee.updated'
  | 'employee.promoted'
  | 'employee.department.changed'
  | 'employee.role.changed'
  | 'employee.permissions.changed'
  | 'employee.salary.changed'
  | 'employee.goal.changed'
  | 'employee.archived'

export type AuditActor = {
  userId: string | null      // quem executou (null = sistema/automação)
  name: string | null
}

export type AuditOrigin = 'ui' | 'api' | 'automation' | 'import' | 'system'

// Diff imutável de UM campo (antes → depois).
export type AuditChange = {
  field: string
  before: string | number | boolean | null
  after: string | number | boolean | null
}

export type PeopleAuditEntry = {
  id: string
  teamId: string             // workspace (TEAM-001)
  action: PeopleAuditAction
  eventType: EventType       // employee.* correspondente (mesma string do EVENT_CATALOG)
  collaboratorId: string     // alvo
  actor: AuditActor          // usuário que fez
  origin: AuditOrigin
  ip: string | null          // placeholder honesto — não capturado nesta fase
  changes: AuditChange[]     // antes/depois
  at: string                 // ISO — carimbado por quem cria (não gerar tempo aqui)
}

// Ponte com o Event Bus: a ação de auditoria É o EventType canônico (Part 8).
export function auditEventType(action: PeopleAuditAction): EventType {
  return action
}
