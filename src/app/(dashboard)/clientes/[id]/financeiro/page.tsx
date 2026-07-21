import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getClientFinance } from '@/server/services/ClientFinanceService'
import { currentBillingProfile } from '@/lib/billing/profile'
import { ClientFinance } from '@/components/client/ClientFinance'
import { ClientBilling } from '@/components/client/ClientBilling'
import { ClientPaymentsPanel } from '@/components/client/ClientPaymentsPanel'
import { getClientWorkspace } from '@/server/services/ClientWorkspaceService'

// Financeiro do Cliente — dados REAIS (client_payments) via ClientFinanceService (ARCH-001, TEAM-001) +
// preparação visual de cobrança/Stripe (CustomerBillingProfile, sem integração real).
export default async function ClientFinanceiroPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const vm = context ? await getClientFinance(context, params.id) : null
  const client = context ? await getClientWorkspace(params.id) : null
  if (!vm || !client) notFound()

  return (
    <div className="space-y-6">
      <ClientFinance vm={vm} />
      <ClientPaymentsPanel
        clients={[{ id: client.id, name: client.name }]}
        defaultOpen
        defaultClientId={client.id}
        title="Editar semanas e recebimentos"
      />
      <ClientBilling billing={currentBillingProfile()} />
    </div>
  )
}
