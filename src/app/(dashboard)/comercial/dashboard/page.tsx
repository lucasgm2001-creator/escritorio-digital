import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { getExecutiveMetrics } from '@/server/services/ExecutiveMetricsService'
import { buildCommercialReport } from '@/server/services/ReportingService'
import { DashboardExecutivo } from '@/components/dashboard/DashboardExecutivo'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

// Dashboard Executivo — PRIMEIRO consumidor da FONTE ÚNICA (EXECUTIVE-METRICS-002). Todos os KPIs executivos
// (receita recebida/prevista, valor fechado, MRR/ARR, ticket, conversão, clientes, por vendedor/plano) vêm do
// ExecutiveMetricsService; funil por etapa + insights + conversões-por-etapa continuam no ReportingService
// (fonte única deles, period-aware). ZERO cálculo na tela (ARCH-001). 'semana' só p/ a Receita Semanal.
export default async function DashboardExecutivoPage() {
  const context = await getRequestContext()
  const now = new Date()
  const period = {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: now.toISOString(),
    label: 'Este mês',
  }
  const data = context
    ? await Promise.all([
        getExecutiveMetrics(context, 'mes'),
        getExecutiveMetrics(context, 'semana'),
        buildCommercialReport(context, period),
      ])
    : null

  return (
    <div className="space-y-5 md:space-y-6">
      <Link href="/comercial" className="inline-flex items-center gap-1 text-sm text-bento-muted min-h-control md:min-h-0">
        <ChevronLeft className="w-4 h-4" /> Comercial
      </Link>
      <WorkspaceHeader
        breadcrumb={['Comercial', 'Dashboard']}
        title="Visão comercial"
        subtitle="Métricas da fonte única (ExecutiveMetricsService); funil e insights do ReportingService — sem cálculo na tela."
      />
      {data
        ? <DashboardExecutivo vm={data[0]} weekReceita={data[1].receitaRecebida} report={data[2]} />
        : <p className="text-sm text-bento-muted">Sem equipe ativa.</p>}
    </div>
  )
}
