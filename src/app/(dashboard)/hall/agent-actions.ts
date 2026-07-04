'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createClient } from '@/lib/supabase/server'

// Escrita própria do agente do Hall (PERMISSIONS-004). O agente cria TAREFAS gerais (com data e vínculo
// opcional a um lead por nome) — diferente da tarefa de lead do funil, por isso action própria. Roteia pelo
// servidor: valida sessão/equipe/permissão (commercial.edit — 'hall' não tem ação de escrita no catálogo),
// carimba team_id no servidor e resolve o vínculo do lead server-side. Nunca confia na UI.
type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export async function createAgentTaskAction(input: {
  title: string
  dueDate: string | null
  dueTime: string | null
  linkedLeadName?: string | null
}): Promise<Res<{ taskId: string; linkedName: string | null }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!can(context, 'commercial', 'edit')) return { ok: false, error: 'Você não tem permissão para criar tarefas.' }
  const title = input.title.trim()
  if (!title) return { ok: false, error: 'Faltou o título da tarefa.' }

  const supabase = createClient()
  const teamId = context.activeTeamId

  // Vínculo opcional: casa por nome com um lead existente (mesma regra da UI, agora no servidor).
  let link: { linked_type: string; linked_id: string; linked_name: string } | null = null
  if (input.linkedLeadName) {
    const { data } = await supabase.from('leads').select('id, name').ilike('name', `%${input.linkedLeadName}%`).limit(1)
    if (data && data[0]) link = { linked_type: 'lead', linked_id: data[0].id as string, linked_name: data[0].name as string }
  }

  const { data: created, error } = await supabase.from('tasks').insert({
    user_id: context.user.id, title, due_date: input.dueDate, due_time: input.dueTime, done: false,
    ...(link ?? {}), ...(teamId ? { team_id: teamId } : {}),
  }).select('id').single()
  if (error || !created) return { ok: false, error: error?.message ?? 'Não foi possível criar a tarefa.' }
  return { ok: true, taskId: created.id as string, linkedName: link?.linked_name ?? null }
}
