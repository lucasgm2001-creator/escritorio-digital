'use server'

import { createClient } from '@/lib/supabase/server'
import { requireActionContext } from '@/server/actions/safe-action'

// Lançamento de investimento em marketing (Aquisição — EXECUTIVE-METRICS-005). Mesma trilha das demais
// escritas do Comercial (PERMISSIONS-003): UI → action → can('commercial','edit') → Supabase. team_id
// carimbado no servidor (nunca vem da UI); a leitura/soma fica no ExecutiveMetricsService (fonte única).

type Err = { ok: false; error: string }
type Res<T = object> = ({ ok: true } & T) | Err

const DENY = 'Você não tem permissão para lançar investimento no Comercial.'
const EXPIRED = 'Sessão expirada. Entre novamente.'

export async function createMarketingInvestmentAction(input: {
  spentOn: string
  amountUsd: number
  note: string | null
}): Promise<Res> {
  const g = await requireActionContext({
    permission: { module: 'commercial', action: 'edit' },
    deniedMessage: DENY,
    expiredMessage: EXPIRED,
    requireActiveTeam: true,
    noActiveTeamMessage: 'Selecione uma equipe ativa.',
  })
  if (!g.context) return { ok: false, error: g.error.message }

  const amount = Number(input.amountUsd)
  if (!input.spentOn || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Informe uma data e um valor válido.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('marketing_investments').insert({
    team_id: g.context.activeTeamId,
    spent_on: input.spentOn,
    amount_usd: amount,
    note: input.note?.trim() || null,
    created_by: g.context.user.id,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
