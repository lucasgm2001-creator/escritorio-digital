import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { OnboardingMirror, type MirrorRow } from './OnboardingMirror'

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
  const { data } = await supabase.from('client_onboarding')
    .select('step_key, status, resposta').eq('client_id', id)

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title="Onboarding"
        subtitle={`O que foi definido na reunião de início com ${client.name}. Preenchido no Studio; aqui é só leitura.`}
        size="compact"
      />
      <OnboardingMirror clientName={client.name} rows={(data ?? []) as MirrorRow[]} />
    </div>
  )
}
