'use server'

import { createClient } from '@/lib/supabase/server'
import { pickAllowed, requireActionContext, toActionError, type ActionError } from '@/server/actions/safe-action'

// Escritas de FASES DO FUNIL (config do Comercial — PERMISSIONS-004). Estruturar o funil é ação de ADMIN do
// módulo: exige commercial.manage. Retorno { error } (drop-in para os handlers). team_id carimbado no servidor.
// A exclusão NUNCA orfana lead: reatribui os leads da fase ANTES de apagá-la (mesma regra da UI, agora servidor).
type WriteError = ActionError

const DENY = 'Você não tem acesso de administrador ao Comercial.'

// Colunas editáveis de uma fase (renome/cor/dias/ordem/grupo/flag de contagem/arquivar). Flags estruturais
// (is_won/is_system/…) NÃO entram no update — só na criação.
const STAGE_UPDATE_COLS = ['nome', 'cor', 'dias_esfriamento', 'posicao', 'grupo', 'conta_interagiu', 'arquivada'] as const
const STAGE_CREATE_COLS = [
  'nome', 'slug', 'posicao', 'grupo', 'dias_esfriamento', 'cor',
  'is_won', 'is_lost', 'is_system', 'conta_interagiu', 'conta_reuniao', 'conta_fechou', 'arquivada',
] as const

async function guardManage() {
  return requireActionContext({
    permission: { module: 'commercial', action: 'manage' },
    deniedMessage: DENY,
  })
}

// Atualiza N fases por SLUG (reordenação, mover de grupo, editar uma fase). Uma chamada só, gated uma vez.
export async function updateStagesAction(updates: { slug: string; patch: Record<string, unknown> }[]): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  // Defense-in-depth (SECURITY-ACTIONS-001): mutações por slug/grupo/status podem colidir entre equipes → o
  // filtro por team_id no servidor garante que só a fase da equipe ativa é tocada (mesmo sem RLS).
  const teamId = g.context.activeTeamId
  for (const u of updates) {
    const clean = pickAllowed(u.patch, STAGE_UPDATE_COLS)
    if (Object.keys(clean).length === 0) continue
    let q = supabase.from('funnel_stages').update(clean).eq('slug', u.slug)
    if (teamId) q = q.eq('team_id', teamId)
    const { error } = await q
    if (error) return { error: toActionError(error) }
  }
  return { error: null }
}

// Renomeia um GRUPO (UPDATE funnel_stages SET grupo=novo WHERE grupo=antigo).
export async function renameStageGroupAction(oldName: string, newName: string): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  let q = supabase.from('funnel_stages').update({ grupo: newName }).eq('grupo', oldName)
  if (teamId) q = q.eq('team_id', teamId)
  const { error } = await q
  return { error: toActionError(error) }
}

// Cria uma fase. O retry de slug único (23505) fica no chamador — a action devolve o code p/ decidir.
export async function createStageAction(row: Record<string, unknown>): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const payload = { ...pickAllowed(row, STAGE_CREATE_COLS), ...(teamId ? { team_id: teamId } : {}) }
  const { error } = await supabase.from('funnel_stages').insert(payload)
  return { error: toActionError(error) }
}

// Exclui a fase reatribuindo os leads dela ANTES (nunca orfana). destStatus só é usado quando há leads.
export async function deleteStageAction(slug: string, destStatus: string, hasLeads: boolean): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  if (hasLeads) {
    let q1 = supabase.from('leads').update({ status: destStatus }).eq('status', slug)
    if (teamId) q1 = q1.eq('team_id', teamId)
    const { error: e1 } = await q1
    if (e1) return { error: toActionError(e1) }
  }
  let q2 = supabase.from('funnel_stages').delete().eq('slug', slug)
  if (teamId) q2 = q2.eq('team_id', teamId)
  const { error: e2 } = await q2
  return { error: toActionError(e2) }
}
