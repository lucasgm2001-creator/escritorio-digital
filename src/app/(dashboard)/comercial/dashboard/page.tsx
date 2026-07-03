import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { getCommercialDashboard } from '@/server/services/DashboardMetricsService'
import { buildCommercialReport } from '@/server/services/ReportingService'
import { DashboardExecutivo } from '@/components/dashboard/DashboardExecutivo'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

// Dashboard Executivo — KPIs do DashboardMetricsService + insights/funil/conversões do ReportingService.
// Dois serviços (fonte única cada), nenhuma conta na UI (ARCH-001).
export default async function DashboardExecutivoPage() {
  const context = await getRequestContext()
  const now = new Date()
  const period = {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: now.toISOString(),
    label: 'Este mês',
  }
  const data = context
    ? await Promise.all([getCommercialDashboard(context), buildCommercialReport(context, period)])
    : null

  return (
    <div className="space-y-5 md:space-y-6">
      <Link href="/comercial" className="inline-flex items-center gap-1 text-sm text-bento-muted min-h-[44px] md:min-h-0">
        <ChevronLeft className="w-4 h-4" /> Comercial
      </Link>
      <WorkspaceHeader
        eyebrow="Dashboard Executivo"
        title="Visão comercial"
        subtitle="Indicadores do DashboardMetricsService; insights e funil do ReportingService — fonte única, sem cálculo na tela."
      />
      {data ? <DashboardExecutivo vm={data[0]} report={data[1]} /> : <p className="text-sm text-bento-muted">Sem equipe ativa.</p>}
    </div>
  )
}
