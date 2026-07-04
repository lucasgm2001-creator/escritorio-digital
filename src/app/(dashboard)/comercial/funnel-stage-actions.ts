'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createClient } from '@/lib/supabase/server'

// Escritas de FASES DO FUNIL (config do Comercial — PERMISSIONS-004). Estruturar o funil é ação de ADMIN do
// módulo: exige commercial.manage. Retorno { error } (drop-in para os handlers). team_id carimbado no servidor.
// A exclusão NUNCA orfana lead: reatribui os leads da fase ANTES de apagá-la (mesma regra da UI, agora servidor).
type WriteError = { message: string; code?: string } | null

const DENY: WriteError = { message: 'Você não tem acesso de administrador ao Comercial.' }
const EXPIRED: WriteError = { message: 'Sessão expirada. Entre novamente.' }

// Colunas editáveis de uma fase (renome/cor/dias/ordem/grupo/flag de contagem/arquivar). Flags estruturais
// (is_won/is_system/…) NÃO entram no update — só na criação.
const STAGE_UPDATE_COLS = ['nome', 'cor', 'dias_esfriamento', 'posicao', 'grupo', 'conta_interagiu', 'arquivada'] as const
const STAGE_CREATE_COLS = [
  'nome', 'slug', 'posicao', 'grupo', 'dias_esfriamento', 'cor',
  'is_won', 'is_lost', 'is_system', 'conta_interagiu', 'conta_reuniao', 'conta_fechou', 'arquivada',
] as const

function pick(input: Record<string, unknown>, cols: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of cols) if (key in input) out[key] = input[key]
  return out
}

async function guardManage() {
  const context = await getRequestContext()
  if (!context) return { context: null, error: EXPIRED } as const
  if (!can(context, 'commercial', 'manage')) return { context: null, error: DENY } as const
  return { context, error: null } as const
}

// Atualiza N fases por SLUG (reordenação, mover de grupo, editar uma fase). Uma chamada só, gated uma vez.
export async function updateStagesAction(updates: { slug: string; patch: Record<string, unknown> }[]): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  for (const u of updates) {
    const clean = pick(u.patch, STAGE_UPDATE_COLS)
    if (Object.keys(clean).length === 0) continue
    const { error } = await supabase.from('funnel_stages').update(clean).eq('slug', u.slug)
    if (error) return { error: { message: error.message, code: error.code } }
  }
  return { error: null }
}

// Renomeia um GRUPO (UPDATE funnel_stages SET grupo=novo WHERE grupo=antigo).
export async function renameStageGroupAction(oldName: string, newName: string): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const { error } = await supabase.from('funnel_stages').update({ grupo: newName }).eq('grupo', oldName)
  return { error: error ? { message: error.message } : null }
}

// Cria uma fase. O retry de slug único (23505) fica no chamador — a action devolve o code p/ decidir.
export async function createStageAction(row: Record<string, unknown>): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  const teamId = g.context.activeTeamId
  const payload = { ...pick(row, STAGE_CREATE_COLS), ...(teamId ? { team_id: teamId } : {}) }
  const { error } = await supabase.from('funnel_stages').insert(payload)
  return { error: error ? { message: error.message, code: error.code } : null }
}

// Exclui a fase reatribuindo os leads dela ANTES (nunca orfana). destStatus só é usado quando há leads.
export async function deleteStageAction(slug: string, destStatus: string, hasLeads: boolean): Promise<{ error: WriteError }> {
  const g = await guardManage()
  if (!g.context) return { error: g.error }
  const supabase = createClient()
  if (hasLeads) {
    const { error: e1 } = await supabase.from('leads').update({ status: destStatus }).eq('status', slug)
    if (e1) return { error: { message: e1.message } }
  }
  const { error: e2 } = await supabase.from('funnel_stages').delete().eq('slug', slug)
  return { error: e2 ? { message: e2.message } : null }
}
