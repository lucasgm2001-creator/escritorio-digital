'use client'

import { useEffect, useState } from 'react'
import { DashboardExecutivo } from '@/components/dashboard/DashboardExecutivo'
import { getVisaoGeralAction, type VisaoGeralResult } from '../visao-geral-actions'

// Aba "Visão Geral" do Comercial — ex-rota /comercial/dashboard, agora aba (mesma fonte: getExecutiveMetrics
// + buildCommercialReport via visao-geral-actions.ts). Período fixo "mês atual"; o seletor de período mora
// só no Relatório (Minha Mesa). ZERO cálculo aqui — só busca o VM pronto e repassa ao DashboardExecutivo.
export function VisaoGeralTab() {
  const [data, setData] = useState<Extract<VisaoGeralResult, { ok: true }> | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    getVisaoGeralAction().then(res => {
      if (!active) return
      if (res.ok) setData(res)
      setLoaded(true)
    })
    return () => { active = false }
  }, [])

  if (!loaded) return <div className="h-full flex items-center justify-center text-sm text-bento-muted">Carregando…</div>
  if (!data) return <div className="p-6 text-sm text-bento-muted">Sem equipe ativa.</div>

  return (
    <div className="p-4 sm:p-6 overflow-auto h-full bg-background">
      <DashboardExecutivo vm={data.vm} weekReceita={data.weekReceita} report={data.report} />
    </div>
  )
}
