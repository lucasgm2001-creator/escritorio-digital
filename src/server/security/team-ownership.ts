import 'server-only'

import type { createServiceClient } from '@/lib/supabase/service'

// Guardas de PROPRIEDADE por equipe para rotas service-role (P1-SERVICEROLE-001). O service-role IGNORA a
// RLS, então toda rota que recebe um id da UI precisa confirmar, ANTES de qualquer processamento, que o
// registro pertence à equipe ATIVA do usuário. Estes helpers leem SÓ id+team_id (mais colunas opcionais para
// reuso) e devolvem a linha — sem 2ª query. Não alteram dados nem regra de negócio; só barram cross-team.

type SupaService = ReturnType<typeof createServiceClient>

export type Ownership<T> =
  | { ok: true; row: T }
  | { ok: false; status: 403 | 404 }

// Confirma que a linha `id` de `table` é da equipe `activeTeamId`. 404 se não existe; 403 se é de outra
// equipe (ou sem equipe ativa / sem id). Genérico — serve leads, clients, deals, meetings, sellers, tasks...
export async function assertRowTeam<T extends Record<string, unknown>>(
  svc: SupaService,
  table: string,
  id: string | null | undefined,
  activeTeamId: string | null,
  columns = 'id, team_id',
  liveOnly = false,   // SOFT-DELETE: leads/clients excluídos (deleted_at) tratados como inexistentes (404)
): Promise<Ownership<T>> {
  if (!id || !activeTeamId) return { ok: false, status: 403 }
  let q = svc.from(table).select(columns).eq('id', id)
  if (liveOnly) q = q.is('deleted_at', null)
  const { data } = await q.maybeSingle()
  if (!data) return { ok: false, status: 404 }
  // `data` vem como união (colunas dinâmicas) — normaliza via unknown antes de checar/retornar.
  const row = data as unknown as { team_id?: string | null }
  if (row.team_id !== activeTeamId) return { ok: false, status: 403 }
  return { ok: true, row: data as unknown as T }
}

// Atalhos por tabela (a mesma guarda; nomes explícitos para o call site). Novas tabelas: use assertRowTeam
// direto (ex.: assertRowTeam(svc, 'meetings', id, activeTeamId)) — sem duplicar lógica.
export function assertLeadOwnership<T extends Record<string, unknown>>(
  svc: SupaService, id: string | null | undefined, activeTeamId: string | null, columns = 'id, team_id',
): Promise<Ownership<T>> {
  return assertRowTeam<T>(svc, 'leads', id, activeTeamId, columns, true)   // excluído → 404
}

export function assertClientOwnership<T extends Record<string, unknown>>(
  svc: SupaService, id: string | null | undefined, activeTeamId: string | null, columns = 'id, team_id',
): Promise<Ownership<T>> {
  return assertRowTeam<T>(svc, 'clients', id, activeTeamId, columns, true)   // excluído → 404
}
