'use server'

import { createClient } from '@/lib/supabase/server'
import { requireActionContext } from '@/server/actions/safe-action'

// CRUD do ROTEIRO de onboarding (ONBOARDING-003). Configurar o roteiro é editar o processo da equipe,
// então exige can('clients','edit') — o mesmo nível de quem conduz a reunião.
//
// EXCLUIR é `ativo = false`, nunca DELETE: o tópico some do roteiro mas as respostas de clientes que já
// passaram por ele continuam legíveis no espelho e no PDF. Apagar de verdade levaria junto o histórico.

type Res = { ok: true } | { ok: false; error: string }

async function guard() {
  const g = await requireActionContext({
    permission: { module: 'clients', action: 'edit' },
    deniedMessage: 'Você não tem permissão para configurar o onboarding.',
    expiredMessage: 'Sessão expirada. Entre novamente.',
  })
  if (!g.context?.activeTeamId) return null
  return { context: g.context, teamId: g.context.activeTeamId, supabase: createClient() }
}

export type StepInput = {
  titulo: string
  ajuda?: string | null
  pedeResposta: boolean
  rotuloResposta?: string | null
  exemploResposta?: string | null
  parentId?: string | null
}

export async function createOnboardingStepAction(input: StepInput): Promise<Res> {
  const g = await guard()
  if (!g) return { ok: false, error: 'Sem permissão para configurar o onboarding.' }
  const titulo = input.titulo?.trim()
  if (!titulo) return { ok: false, error: 'Dê um título ao tópico.' }

  // Subtópico de subtópico não existe: a hierarquia é de UM nível. Se o pai já tem pai, sobe para a raiz
  // dele — assim um clique errado não cria uma árvore que a tela não sabe desenhar.
  let parentId = input.parentId ?? null
  if (parentId) {
    const { data: pai } = await g.supabase.from('onboarding_steps')
      .select('id, parent_id').eq('id', parentId).eq('team_id', g.teamId).maybeSingle()
    if (!pai) return { ok: false, error: 'Tópico pai não encontrado.' }
    parentId = (pai.parent_id as string | null) ?? (pai.id as string)
  }

  // Entra no fim da lista do SEU nível (raiz ou irmãos do mesmo pai).
  let irmaosQuery = g.supabase.from('onboarding_steps')
    .select('posicao').eq('team_id', g.teamId).eq('ativo', true)
  irmaosQuery = parentId ? irmaosQuery.eq('parent_id', parentId) : irmaosQuery.is('parent_id', null)
  const { data: irmaos } = await irmaosQuery
  const maxPos = (irmaos ?? []).reduce((m, r) => Math.max(m, Number(r.posicao) || 0), 0)

  const { error } = await g.supabase.from('onboarding_steps').insert({
    team_id: g.teamId,
    parent_id: parentId,
    titulo,
    ajuda: input.ajuda?.trim() || null,
    pede_resposta: !!input.pedeResposta,
    rotulo_resposta: input.pedeResposta ? (input.rotuloResposta?.trim() || 'Resposta') : null,
    exemplo_resposta: input.pedeResposta ? (input.exemploResposta?.trim() || null) : null,
    posicao: maxPos + 1,
  })
  if (error) return { ok: false, error: 'Não foi possível criar o tópico.' }
  return { ok: true }
}

export async function updateOnboardingStepAction(id: string, input: StepInput): Promise<Res> {
  const g = await guard()
  if (!g) return { ok: false, error: 'Sem permissão para configurar o onboarding.' }
  const titulo = input.titulo?.trim()
  if (!titulo) return { ok: false, error: 'Dê um título ao tópico.' }

  const { error } = await g.supabase.from('onboarding_steps').update({
    titulo,
    ajuda: input.ajuda?.trim() || null,
    pede_resposta: !!input.pedeResposta,
    rotulo_resposta: input.pedeResposta ? (input.rotuloResposta?.trim() || 'Resposta') : null,
    exemplo_resposta: input.pedeResposta ? (input.exemploResposta?.trim() || null) : null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('team_id', g.teamId)
  if (error) return { ok: false, error: 'Não foi possível salvar o tópico.' }
  return { ok: true }
}

/** Remove do roteiro sem apagar histórico. Subtópicos saem junto — sozinhos não fazem sentido. */
export async function removeOnboardingStepAction(id: string): Promise<Res> {
  const g = await guard()
  if (!g) return { ok: false, error: 'Sem permissão para configurar o onboarding.' }
  const agora = new Date().toISOString()
  const { error } = await g.supabase.from('onboarding_steps')
    .update({ ativo: false, updated_at: agora })
    .or(`id.eq.${id},parent_id.eq.${id}`).eq('team_id', g.teamId)
  if (error) return { ok: false, error: 'Não foi possível remover o tópico.' }
  return { ok: true }
}

/** Sobe ou desce um tópico trocando de posição com o vizinho do MESMO nível. */
export async function moveOnboardingStepAction(id: string, direcao: 'cima' | 'baixo'): Promise<Res> {
  const g = await guard()
  if (!g) return { ok: false, error: 'Sem permissão para configurar o onboarding.' }

  const { data: alvo } = await g.supabase.from('onboarding_steps')
    .select('id, parent_id, posicao').eq('id', id).eq('team_id', g.teamId).maybeSingle()
  if (!alvo) return { ok: false, error: 'Tópico não encontrado.' }

  let q = g.supabase.from('onboarding_steps')
    .select('id, posicao').eq('team_id', g.teamId).eq('ativo', true)
  q = alvo.parent_id ? q.eq('parent_id', alvo.parent_id) : q.is('parent_id', null)
  const { data: irmaos } = await q.order('posicao')

  const lista = (irmaos ?? []) as { id: string; posicao: number }[]
  const i = lista.findIndex(x => x.id === id)
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true }   // já é o primeiro/último

  // Troca as posições. Duas escritas pequenas — reordenar a lista inteira seria pior com muitos tópicos.
  await g.supabase.from('onboarding_steps').update({ posicao: lista[j].posicao }).eq('id', lista[i].id).eq('team_id', g.teamId)
  await g.supabase.from('onboarding_steps').update({ posicao: lista[i].posicao }).eq('id', lista[j].id).eq('team_id', g.teamId)
  return { ok: true }
}
