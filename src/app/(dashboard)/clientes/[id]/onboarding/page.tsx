import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { OnboardingChecklist, type OnboardingRow } from './OnboardingChecklist'

// Onboarding do cliente (ONBOARDING-001). O roteiro é fixo (lib/client/onboarding); aqui só carregamos o
// que já foi decidido. Etapa sem linha no banco é "aberta" — por isso a leitura é só das linhas tocadas.
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
        subtitle={`Roteiro da reunião de início com ${client.name}. Escreva o que foi combinado e marque o desfecho de cada etapa.`}
        size="compact"
      />
      <OnboardingChecklist clientId={id} rows={(data ?? []) as OnboardingRow[]} />
    </div>
  )
}
