import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { getCommercialDashboard } from '@/server/services/DashboardMetricsService'
import { DashboardExecutivo } from '@/components/dashboard/DashboardExecutivo'

// Dashboard Executivo — visão comercial consolidada (fonte única: DashboardMetricsService).
export default async function DashboardExecutivoPage() {
  const context = await getRequestContext()
  const vm = context ? await getCommercialDashboard(context) : null

  return (
    <div className="space-y-5 md:space-y-6">
      <Link href="/comercial" className="inline-flex items-center gap-1 text-sm text-bento-muted min-h-[44px] md:min-h-0">
        <ChevronLeft className="w-4 h-4" /> Comercial
      </Link>
      <header>
        <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">Dashboard Executivo</p>
        <h1 className="font-display font-bold text-2xl text-bento-text">Visão comercial</h1>
        <p className="text-sm text-bento-muted mt-1">Todos os indicadores nascem do DashboardMetricsService — fonte única, sem duplicação.</p>
      </header>
      {vm ? <DashboardExecutivo vm={vm} /> : <p className="text-sm text-bento-muted">Sem equipe ativa.</p>}
    </div>
  )
}
