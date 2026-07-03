import type { PermissionModule } from '@/lib/permissions/types'
import type { TeamRoleDefault } from './catalog'

// Acesso GRANULAR por módulo (PEOPLE-002, Parts 4/6). NÃO é uma 2ª engine — é uma camada de RESOLUÇÃO por
// cima do modelo existente (papel → padrão → override → efetivo). Puro e determinístico (server E client
// podem ler), mas a AUTORIDADE é o servidor: a página compõe a matriz efetiva e toda mudança passa por uma
// action validada (Part 7). Cada módulo mapeia (quando existe) a um PermissionModule do catálogo oficial —
// reuso do can()/PERMISSION_CATALOG, sem duplicar. Módulos sem mapeamento ainda não têm ações no catálogo;
// o nível vale como contrato até PERMISSION-001 os incorporar.

export type ModuleLevel = 'none' | 'read' | 'edit' | 'admin'
export const MODULE_LEVELS: ModuleLevel[] = ['none', 'read', 'edit', 'admin']
export const MODULE_LEVEL_LABEL: Record<ModuleLevel, string> = {
  none: 'Sem acesso', read: 'Somente leitura', edit: 'Editar', admin: 'Administrador',
}

export type AppModule = {
  key: string
  label: string
  permission: PermissionModule | null   // vínculo com can()/catalog quando o módulo já tem ações
}

export const APP_MODULES: AppModule[] = [
  { key: 'hall',          label: 'Hall',          permission: 'hall' },
  { key: 'clientes',      label: 'Clientes',      permission: 'clients' },
  { key: 'comercial',     label: 'Comercial',     permission: 'commercial' },
  { key: 'trafego',       label: 'Tráfego',       permission: 'traffic' },
  { key: 'financeiro',    label: 'Financeiro',    permission: 'finance' },
  { key: 'configuracoes', label: 'Configurações', permission: 'settings' },
  { key: 'equipe',        label: 'Equipe',        permission: 'teams' },
  { key: 'colaboradores', label: 'Colaboradores', permission: 'users' },
  { key: 'remuneracao',   label: 'Remuneração',   permission: null },
  { key: 'eventos',       label: 'Eventos',       permission: null },
  { key: 'integracoes',   label: 'Integrações',   permission: null },
  { key: 'ia',            label: 'IA',            permission: null },
  { key: 'relatorios',    label: 'Relatórios',    permission: 'reports' },
]

// Nível PADRÃO por papel de acesso (Part 4): owner/admin → admin em tudo; member → leitura em tudo.
export function baseLevelForRole(teamRole: TeamRoleDefault): ModuleLevel {
  return teamRole === 'owner' || teamRole === 'admin' ? 'admin' : 'read'
}

// Override por colaborador (nível específico por módulo). SEM persistência nesta fase — a UI/action fornece;
// onde salvar fica para a migration proposta (não aplicada).
export type ModuleOverride = Partial<Record<string, ModuleLevel>>

// Nível EFETIVO de um módulo = override[módulo] ?? padrão do papel.
export function effectiveModuleLevel(teamRole: TeamRoleDefault, moduleKey: string, override: ModuleOverride = {}): ModuleLevel {
  return override[moduleKey] ?? baseLevelForRole(teamRole)
}

export type ModuleAccessRow = { key: string; label: string; level: ModuleLevel; overridden: boolean }

// Matriz EFETIVA completa (todos os módulos) — a página compõe no servidor e a UI só renderiza.
export function effectiveModuleMatrix(teamRole: TeamRoleDefault, override: ModuleOverride = {}): ModuleAccessRow[] {
  return APP_MODULES.map(m => ({
    key: m.key,
    label: m.label,
    level: effectiveModuleLevel(teamRole, m.key, override),
    overridden: override[m.key] != null,
  }))
}
