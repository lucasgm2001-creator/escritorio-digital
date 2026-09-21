'use server'

import { createClient } from '@/lib/supabase/server'
import { requireActionContext } from '@/server/actions/safe-action'
import { ONBOARDING_STEPS, type OnboardingStatus } from '@/lib/client/onboarding'

// Escrita do ONBOARDING (ONBOARDING-001). Uma linha por etapa TOCADA; etapa sem linha é "aberta".
// Roteada pelo servidor como o resto do módulo Clientes: can('clients','edit') + team_id carimbado aqui,
// nunca vindo da UI. A RLS (client_onboarding) segue por baixo.

type Res = { ok: true } | { ok: false; error: string }

export async function saveOnboardingStepAction(
  clientId: string, stepKey: string, status: OnboardingStatus, resposta: string | null,
): Promise<Res> {
  const g = await requireActionContext({
    permission: { module: 'clients', action: 'edit' },
    deniedMessage: 'Você não tem permissão para editar em Clientes.',
    expiredMessage: 'Sessão expirada. Entre novamente.',
  })
  if (!g.context) return { ok: false, error: g.error.message }
  const teamId = g.context.activeTeamId
  if (!teamId) return { ok: false, error: 'Equipe ativa não encontrada.' }

  // stepKey vem da UI: só aceita chave que existe no roteiro. Sem isto daria para gravar etapa inventada.
  if (!ONBOARDING_STEPS.some(s => s.key === stepKey)) return { ok: false, error: 'Etapa desconhecida.' }
  if (status !== 'concluido' && status !== 'pendente') return { ok: false, error: 'Situação inválida.' }

  const supabase = createClient()
  // Confirma que o cliente é da equipe ativa ANTES de gravar — a RLS já cobre, isto é defesa em profundidade
  // no mesmo padrão das demais escritas do módulo.
  const { data: cli } = await supabase.from('clients')
    .select('id').eq('id', clientId).eq('team_id', teamId).is('deleted_at', null).maybeSingle()
  if (!cli) return { ok: false, error: 'Cliente não encontrado nesta equipe.' }

  const { error } = await supabase.from('client_onboarding').upsert({
    team_id: teamId,
    client_id: clientId,
    step_key: stepKey,
    status,
    resposta: resposta?.trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: g.context.user.id,
  }, { onConflict: 'client_id,step_key' })

  if (error) return { ok: false, error: 'Não foi possível salvar a etapa.' }
  return { ok: true }
}

/** Desfaz a marcação: a etapa volta a ficar ABERTA (a linha some). */
export async function clearOnboardingStepAction(clientId: string, stepKey: string): Promise<Res> {
  const g = await requireActionContext({
    permission: { module: 'clients', action: 'edit' },
    deniedMessage: 'Você não tem permissão para editar em Clientes.',
    expiredMessage: 'Sessão expirada. Entre novamente.',
  })
  if (!g.context) return { ok: false, error: g.error.message }
  const teamId = g.context.activeTeamId
  if (!teamId) return { ok: false, error: 'Equipe ativa não encontrada.' }

  const supabase = createClient()
  const { error } = await supabase.from('client_onboarding')
    .delete().eq('client_id', clientId).eq('step_key', stepKey).eq('team_id', teamId)
  if (error) return { ok: false, error: 'Não foi possível limpar a etapa.' }
  return { ok: true }
}
