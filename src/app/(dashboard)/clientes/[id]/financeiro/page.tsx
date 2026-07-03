import { notFound } from 'next/navigation'
import { getRequestContext } from '@/server/context/request-context'
import { getClientFinance } from '@/server/services/ClientFinanceService'
import { ClientFinance } from '@/components/client/ClientFinance'

// Financeiro do Cliente — dados REAIS (client_payments) via ClientFinanceService (ARCH-001, TEAM-001).
export default async function ClientFinanceiroPage({ params }: { params: { id: string } }) {
  const context = await getRequestContext()
  const vm = context ? await getClientFinance(context, params.id) : null
  if (!vm) notFound()
  return <ClientFinance vm={vm} />
}
