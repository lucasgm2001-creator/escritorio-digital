import { Wallet } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { listTemplates, getPreview } from '@/server/services/CompensationEngineService'
import { PeopleHeader } from '@/components/people/PeopleHeader'
import { CompensationTemplatesView } from '@/components/admin/CompensationTemplatesView'
import { VendedoresTab } from '@/app/(dashboard)/comercial/tabs/VendedoresTab'

// Administração › Remuneração (ORG-COMP-001). Centro de remuneração: a config REAL de vendedores/salário/
// comissão (VendedoresTab, realocada do Comercial — mesma regra de dinheiro, nada recalculado) + o modelo de
// templates por função da Compensation Engine (leitura/prévia, COMPENSATION-004). /admin já garante owner/admin.
export default async function RemuneracaoPage() {
  const context = await getRequestContext()
  const templates = context ? await listTemplates(context) : []
  // Prévia de exemplo: venda de um plano US$140/semana para o Closer (collab-2).
  const preview = context
    ? await getPreview(context, 'collab-2', { type: 'sale.created', occurredAt: '2026-07-01T12:00:00Z', weeklyValue: 140, saleValue: 140 })
    : null

  return (
    <div className="space-y-8">
      <PeopleHeader
        icon={Wallet}
        title="Remuneração"
        tagline="Vendedores, salário e comissão — e o modelo de templates por função."
        badge="Config"
      />

      {/* Configuração REAL (relocada do Comercial): vendedores, salário com vigência, comissão por venda/
          semana. Mesma Compensation atual — nenhuma regra financeira alterada, nenhum histórico recalculado. */}
      <section className="space-y-3">
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Vendedores &amp; comissão (config atual)</p>
        <VendedoresTab />
      </section>

      {/* Modelo por função (Compensation Engine) — leitura/prévia; a config avançada por função/override
          individual está proposta em docs/ (requer migration, não aplicada nesta sprint). */}
      <section className="space-y-3">
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Templates por função (modelo)</p>
        <CompensationTemplatesView templates={templates} preview={preview} />
      </section>
    </div>
  )
}
