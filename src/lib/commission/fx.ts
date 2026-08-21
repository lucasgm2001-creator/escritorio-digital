import type { createClient } from '@/lib/supabase/client'

type SupaClient = ReturnType<typeof createClient>

// FONTE ÚNICA da cotação efetiva USD→BRL (P2-FX-001). Antes a mesma regra vivia copiada em 4 lugares e de
// dois jeitos diferentes: `.eq('id', 1)` (cron, /api/commission/auto, client-write-actions, process_due_renewals)
// e `.eq('team_id', teamId)` (MyCompensationService). Com uma equipe as duas coincidem; com duas, as escritas
// congelariam a cotação da equipe 1 na receita/comissão de todo mundo.
//
// A cotação NÃO altera o USD — é a moeda base do sistema. Ela só é CONGELADA na linha para o BRL de exibição
// ser histórico e imutável. Por isso "sem cotação" nunca pode virar um chute: quem escreve aborta e tenta no
// próximo ciclo (o catch-up recupera a semana), em vez de gravar um câmbio inventado.

export type FxRow = {
  team_id?: string | null
  cotacao_manual: number | null
  cotacao_travada: boolean | null
  cotacao_referencia: number | null
}

export const FX_COLUMNS = 'team_id, cotacao_manual, cotacao_travada, cotacao_referencia'

/** Travada + manual → manual; senão a referência automática → manual. null = sem cotação utilizável. */
export function effectiveRate(row: FxRow | null | undefined): number | null {
  if (!row) return null
  const manual = row.cotacao_manual != null ? Number(row.cotacao_manual) : null
  const referencia = row.cotacao_referencia != null ? Number(row.cotacao_referencia) : null
  const rate = (row.cotacao_travada && manual != null) ? manual : (referencia ?? manual ?? null)
  return rate != null && rate > 0 ? rate : null
}

/**
 * Todas as cotações, indexadas por equipe, para jobs GLOBAIS (o cron varre todas as equipes numa passada só).
 * `fallback` cobre a equipe que ainda não tem linha própria — assim o multi-tenant nunca fica pior do que o
 * comportamento de linha única que existia antes.
 */
export async function loadTeamRates(
  supabase: SupaClient,
): Promise<{ byTeam: Map<string, number>; fallback: number | null; error: string | null }> {
  const { data, error } = await supabase.from('fx_config').select(FX_COLUMNS)
  if (error) return { byTeam: new Map(), fallback: null, error: error.message }
  const byTeam = new Map<string, number>()
  let fallback: number | null = null
  for (const row of (data ?? []) as FxRow[]) {
    const rate = effectiveRate(row)
    if (rate == null) continue
    if (row.team_id) byTeam.set(row.team_id, rate)
    if (fallback == null) fallback = rate
  }
  return { byTeam, fallback, error: null }
}

/** Cotação de UMA equipe (caminho com sessão). Cai na primeira cotação válida se a equipe não tiver a sua. */
export async function resolveTeamRate(supabase: SupaClient, teamId: string | null | undefined): Promise<number | null> {
  if (teamId) {
    const { data } = await supabase.from('fx_config').select(FX_COLUMNS).eq('team_id', teamId).maybeSingle()
    const rate = effectiveRate(data as FxRow | null)
    if (rate != null) return rate
  }
  const { byTeam, fallback } = await loadTeamRates(supabase)
  return (teamId ? byTeam.get(teamId) : null) ?? fallback
}
