import { Wallet } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { listTemplates } from '@/server/services/CompensationEngineService'
import { PeopleHeader } from '@/components/people/PeopleHeader'
import { CompensationTemplatesView } from '@/components/admin/CompensationTemplatesView'
import { VendedoresTab } from '@/app/(dashboard)/comercial/tabs/VendedoresTab'

// Administração › Remuneração (ORG-COMP-001). Centro de remuneração: a config REAL de vendedores/salário/
// comissão (VendedoresTab, realocada do Comercial — mesma regra de dinheiro, nada recalculado) + o modelo de
// templates por função da Compensation Engine (só leitura). /admin já garante owner/admin.
export default async function RemuneracaoPage() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  const templates = context ? await listTemplates(context) : []

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

      {/* Modelo por função (Compensation Engine) — só leitura das REGRAS de cada template. */}
      <section className="space-y-3">
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Templates por função (modelo)</p>
        <CompensationTemplatesView templates={templates} />
      </section>
    </div>
  )
}
