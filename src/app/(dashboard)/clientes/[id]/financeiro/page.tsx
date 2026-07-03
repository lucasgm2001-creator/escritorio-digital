import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getClientFinance } from '@/server/services/ClientFinanceService'
import { currentBillingProfile } from '@/lib/billing/profile'
import { ClientFinance } from '@/components/client/ClientFinance'
import { ClientBilling } from '@/components/client/ClientBilling'

// Financeiro do Cliente — dados REAIS (client_payments) via ClientFinanceService (ARCH-001, TEAM-001) +
// preparação visual de cobrança/Stripe (CustomerBillingProfile, sem integração real).
export default async function ClientFinanceiroPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const vm = context ? await getClientFinance(context, params.id) : null
  if (!vm) notFound()

  return (
    <div className="space-y-6">
      <ClientFinance vm={vm} />
      <ClientBilling billing={currentBillingProfile()} />
    </div>
  )
}
