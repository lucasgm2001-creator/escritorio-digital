'use server'

import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'

// ACOMPANHANDO (MESA-FOCO-001) — radar pessoal de leads.
//
// SEGURANÇA: user_id sai SEMPRE do contexto do servidor, nunca da UI. O único argumento é o lead, então
// não há como escrever no radar de outra pessoa mesmo chamando a action na mão. A RLS repete a regra por
// baixo (user_id = auth.uid()).

type Res = { ok: true; acompanhando: boolean } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Liga/desliga o lead do radar. Devolve o estado FINAL, para a UI não precisar adivinhar. */
export async function toggleLeadFocusAction(leadId: string, ligar: boolean): Promise<Res> {
  const context = await getRequestContext()
  if (!context?.activeTeamId) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!UUID.test(leadId)) return { ok: false, error: 'Lead inválido.' }

  const supabase = createClient()
  // Confere que o lead é da equipe ativa ANTES de gravar: sem isto daria para fixar no radar um lead de
  // outro time, que depois apareceria na Mesa com nome e telefone.
  const { data: lead } = await supabase.from('leads')
    .select('id').eq('id', leadId).eq('team_id', context.activeTeamId).is('deleted_at', null).maybeSingle()
  if (!lead) return { ok: false, error: 'Lead não encontrado nesta equipe.' }

  if (!ligar) {
    const { error } = await supabase.from('lead_focus').delete()
      .eq('lead_id', leadId).eq('user_id', context.user.id)
    if (error) return { ok: false, error: 'Não foi possível tirar do radar.' }
    return { ok: true, acompanhando: false }
  }

  const { error } = await supabase.from('lead_focus')
    .upsert({ team_id: context.activeTeamId, user_id: context.user.id, lead_id: leadId },
      { onConflict: 'user_id,lead_id' })
  if (error) return { ok: false, error: 'Não foi possível colocar no radar.' }
  return { ok: true, acompanhando: true }
}

/** Fecha as tarefas ANTIGAS de um lead, mantendo só a mais recente. Usado pelo "resolver duplicadas". */
export async function closeStaleLeadTasksAction(leadId: string, keepTaskId: string): Promise<{ ok: boolean; fechadas: number; error?: string }> {
  const context = await getRequestContext()
  if (!context?.activeTeamId) return { ok: false, fechadas: 0, error: 'Sessão expirada. Entre novamente.' }
  if (!UUID.test(leadId) || !UUID.test(keepTaskId)) return { ok: false, fechadas: 0, error: 'Dados inválidos.' }

  const supabase = createClient()
  // Só tarefas DO PRÓPRIO usuário e DESTE lead, e nunca a que ele decidiu manter. Marca como concluída
  // em vez de apagar: a tarefa aconteceu, e o histórico de "Concluídas" é o registro disso.
  const { data, error } = await supabase.from('tasks')
    .update({ done: true, completed_at: new Date().toISOString() })
    .eq('user_id', context.user.id).eq('team_id', context.activeTeamId)
    .eq('linked_type', 'lead').eq('linked_id', leadId)
    .eq('done', false).neq('id', keepTaskId)
    .select('id')
  if (error) return { ok: false, fechadas: 0, error: 'Não foi possível fechar as duplicadas.' }
  return { ok: true, fechadas: (data ?? []).length }
}

/** Encerra um lote de tarefas do próprio usuário. Base do mutirão de atrasados. */
export async function closeTasksBatchAction(ids: string[]): Promise<{ ok: boolean; fechadas: number; error?: string }> {
  const context = await getRequestContext()
  if (!context?.activeTeamId) return { ok: false, fechadas: 0, error: 'Sessão expirada. Entre novamente.' }
  const limpos = [...new Set(ids)].filter(id => UUID.test(id))
  if (limpos.length === 0) return { ok: true, fechadas: 0 }
  // Teto por chamada: a UI manda o que o usuário revisou na tela, e um lote gigante vindo de uma chamada
  // forjada encerraria a agenda inteira de uma vez. 300 cobre com folga o maior mutirão real (112).
  if (limpos.length > 300) return { ok: false, fechadas: 0, error: 'Lote grande demais. Encerre em partes.' }

  const supabase = createClient()
  // Só tarefas DO PRÓPRIO usuário e ainda abertas. Concluída em vez de apagada: a tarefa existiu, e o
  // histórico de "Concluídas" é o registro de que foi encerrada no mutirão.
  const { data, error } = await supabase.from('tasks')
    .update({ done: true, completed_at: new Date().toISOString() })
    .eq('user_id', context.user.id).eq('team_id', context.activeTeamId)
    .eq('done', false).in('id', limpos)
    .select('id')
  if (error) return { ok: false, fechadas: 0, error: 'Não foi possível encerrar as tarefas.' }
  return { ok: true, fechadas: (data ?? []).length }
}
