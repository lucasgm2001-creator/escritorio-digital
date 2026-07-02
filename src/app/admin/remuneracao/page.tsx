import { Wallet } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { listTemplates, getPreview } from '@/server/services/CompensationEngineService'
import { PeopleHeader } from '@/components/people/PeopleHeader'
import { CompensationTemplatesView } from '@/components/admin/CompensationTemplatesView'

// Administração › Remuneração — leitura REAL da Compensation Engine (COMPENSATION-004, PARTE 7).
export default async function RemuneracaoPage() {
  const context = await getRequestContext()
  const templates = context ? await listTemplates(context) : []
  // Prévia de exemplo: venda de um plano US$140/semana para o Closer (collab-2).
  const preview = context
    ? await getPreview(context, 'collab-2', { type: 'sale.created', occurredAt: '2026-07-01T12:00:00Z', weeklyValue: 140, saleValue: 140 })
    : null

  return (
    <div className="space-y-6">
      <PeopleHeader
        icon={Wallet}
        title="Remuneração"
        tagline="Templates de remuneração — leitura real da Compensation Engine."
        badge="Somente leitura"
      />
      <CompensationTemplatesView templates={templates} preview={preview} />
    </div>
  )
}
