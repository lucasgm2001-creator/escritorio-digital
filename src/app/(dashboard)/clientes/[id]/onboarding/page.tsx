import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { OnboardingMirror, type MirrorRow } from './OnboardingMirror'
import { buildTopics, mapStep, STEP_COLUMNS } from '@/lib/client/onboarding'

// Onboarding do cliente — ESPELHO só leitura (ONBOARDING-002). O preenchimento acontece no Studio, que é a
// tela compartilhada com o cliente; aqui é a visão da equipe, ao lado do financeiro e da timeline que o
// cliente nunca vê. Etapa sem linha no banco é "não tratada".
export default async function ClientOnboardingPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const context = await getRequestContext()
  if (!context) notFound()
  const client = await getClientWorkspace(id)   // team-scoped: cliente de outra equipe → notFound
  if (!client) notFound()

  const supabase = createClient()
  // Roteiro vem do banco (editável em Configurações) e as respostas do cliente vêm à parte: tópico
  // removido do roteiro some daqui, mas a resposta continua gravada.
  // Carrega TODOS os tópicos, não só os ativos: um tópico removido do roteiro continua com as respostas
  // dos clientes que passaram por ele, e essa é a razão de a remoção ser lógica (ativo=false) e não DELETE.
  // Sem isto a resposta ficava no banco mas invisível — a preservação não serviria para nada.
  const [{ data: steps }, { data }] = await Promise.all([
    supabase.from('onboarding_steps').select(`${STEP_COLUMNS}, ativo`).order('posicao'),
    supabase.from('client_onboarding').select('step_id, status, resposta').eq('client_id', id),
  ])
  const todos = (steps ?? []) as (Parameters<typeof mapStep>[0] & { ativo: boolean })[]
  const topicos = buildTopics(todos.filter(x => x.ativo).map(mapStep))
  const noRoteiro = new Set(todos.filter(x => x.ativo).map(x => x.id))
  const fora = ((data ?? []) as MirrorRow[])
    .filter(r => !noRoteiro.has(r.step_id))
    .map(r => ({ ...r, titulo: todos.find(x => x.id === r.step_id)?.titulo ?? 'Tópico removido' }))

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title="Onboarding"
        subtitle={`O que foi definido na reunião de início com ${client.name}. Preenchido no Studio e editável aqui.`}
        size="compact"
      />
      <OnboardingMirror clientId={id} clientName={client.name} topicos={topicos} rows={(data ?? []) as MirrorRow[]} fora={fora} />
    </div>
  )
}
