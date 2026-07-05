import { TrendingUp } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { getFinancialView } from '@/server/services/FinancialService'
import { FinanceiroExecutivo } from '@/components/admin/FinanceiroExecutivo'
import { PeopleHeader } from '@/components/people/PeopleHeader'

// Administração › Financeiro (EXECUTIVE-METRICS-005). Painel executivo team-level — TODO número vem do
// FinancialService, que compõe getExecutiveMetrics (fonte única de Hall/Dashboard/Relatórios/PDF) + as
// dimensões financeiras (forma/semanal/evolução/atraso/recebíveis). Nenhum cálculo na tela. /admin já garante
// owner/admin (requireAdminManage reforça no servidor).
export default async function FinanceiroPage() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  const vm = context ? await getFinancialView(context) : null

  return (
    <div className="space-y-6">
      <PeopleHeader
        icon={TrendingUp}
        title="Financeiro"
        tagline="Painel executivo — a mesma fonte única do Hall, Dashboard e Relatórios."
        badge="Executivo"
      />
      {vm?.hasData
        ? <FinanceiroExecutivo vm={vm} />
        : <p className="text-sm text-bento-muted">Sem dados financeiros nesta equipe ainda — aparecem conforme os pagamentos são registrados.</p>}
    </div>
  )
}
