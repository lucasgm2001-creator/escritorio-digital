import type { ModuleLevel, PermissionModule } from '@/lib/permissions/types'
import { MODULE_LEVELS, MODULE_LEVEL_LABEL } from '@/lib/permissions/levels'
import type { TeamRoleDefault } from './catalog'

// Acesso GRANULAR por módulo (PEOPLE-002 / PERMISSIONS-002). NÃO é uma 2ª engine — é a camada de RESOLUÇÃO
// (papel → padrão → override → efetivo) por cima do can()/PERMISSION_CATALOG. Puro e determinístico (server E
// client leem), mas a AUTORIDADE é o servidor: o RequestContext compõe os níveis efetivos e o can() os aplica.
// Cada módulo mapeia (quando existe) a um PermissionModule do catálogo oficial — reuso, sem duplicar.

// Vocabulário de níveis vem da camada base de permissões (fonte única). Reexportado aqui para os consumidores
// do domínio Pessoas seguirem importando destes nomes sem saber da mudança.
export type { ModuleLevel }
export { MODULE_LEVELS, MODULE_LEVEL_LABEL }

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

// Nível PADRÃO por papel de acesso: owner/admin → admin em tudo; member → leitura em tudo.
export function baseLevelForRole(teamRole: TeamRoleDefault): ModuleLevel {
  return teamRole === 'owner' || teamRole === 'admin' ? 'admin' : 'read'
}

// Override por colaborador (nível específico por módulo). Persistido em team_members.permissions.modules
// (jsonb já existente — sem migration). A UI/action fornece; a leitura passa por parseModuleOverride.
export type ModuleOverride = Partial<Record<string, ModuleLevel>>

// Papel de acesso da equipe INCLUINDO guest/sem-equipe — usado na resolução da autoridade.
export type AccessRole = 'owner' | 'admin' | 'member' | 'guest' | null | undefined

// Nível EFETIVO de UM módulo (autoridade). owner/admin = admin SEMPRE (override ignorado — invariante
// "owner/admin podem tudo"); member = override ?? leitura; guest/nulo = sem acesso. Fonte única da resolução.
export function resolveLevel(role: AccessRole, moduleKey: string, override: ModuleOverride = {}): ModuleLevel {
  if (role === 'owner' || role === 'admin') return 'admin'
  if (role === 'member') return override[moduleKey] ?? 'read'
  return 'none'
}

// Compat (assinatura antiga por TeamRoleDefault): delega para resolveLevel.
export function effectiveModuleLevel(teamRole: TeamRoleDefault, moduleKey: string, override: ModuleOverride = {}): ModuleLevel {
  return resolveLevel(teamRole, moduleKey, override)
}

// Lê o override individual de team_members.permissions (`{ modules: { chave: nível } }`). Só níveis VÁLIDOS
// entram; qualquer lixo é ignorado (a resolução nunca quebra por dado ruim no jsonb).
export function parseModuleOverride(permissions: Record<string, unknown> | null | undefined): ModuleOverride {
  const out: ModuleOverride = {}
  const raw = permissions && typeof permissions === 'object' ? (permissions as Record<string, unknown>).modules : null
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string' && (MODULE_LEVELS as string[]).includes(value)) {
        out[key] = value as ModuleLevel
      }
    }
  }
  return out
}

// Mapa EFETIVO por CHAVE de módulo (todos os 13) — navegação e guardas de rota leem por chave.
export function resolveModuleAccess(role: AccessRole, override: ModuleOverride = {}): Record<string, ModuleLevel> {
  const out: Record<string, ModuleLevel> = {}
  for (const m of APP_MODULES) out[m.key] = resolveLevel(role, m.key, override)
  return out
}

// Projeção por PermissionModule (o que o can() consome) — só os módulos já vinculados no catálogo oficial.
export function permissionLevels(access: Record<string, ModuleLevel>): Partial<Record<PermissionModule, ModuleLevel>> {
  const out: Partial<Record<PermissionModule, ModuleLevel>> = {}
  for (const m of APP_MODULES) {
    if (m.permission) out[m.permission] = access[m.key]
  }
  return out
}

export type ModuleAccessRow = { key: string; label: string; level: ModuleLevel; overridden: boolean }

// Matriz EFETIVA completa (todos os módulos) — a página compõe no servidor e a UI só renderiza.
export function effectiveModuleMatrix(role: AccessRole, override: ModuleOverride = {}): ModuleAccessRow[] {
  return APP_MODULES.map(m => ({
    key: m.key,
    label: m.label,
    level: resolveLevel(role, m.key, override),
    overridden: override[m.key] != null,
  }))
}
