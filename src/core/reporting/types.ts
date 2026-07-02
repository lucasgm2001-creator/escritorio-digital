// Modelos de RELATÓRIO (Constituição, Título 4). O PDF NUNCA calcula indicadores — ele consome estes
// modelos, produzidos pelo ReportingService. Fundação: só os contratos.

export type ReportPeriod = { from: string; to: string; label: string }

export type ReportKpis = {
  totalLeads: number
  newLeads: number
  meetingsScheduled: number
  meetingsHeld: number
  noShow: number
  proposals: number
  proposalsInReview: number
  won: number
  lost: number
  conversionRate: number   // 0..1
  avgCycleDays: number
  avgTicket: number
  totalValue: number
}

// Movimentação de pipeline: cada TRANSIÇÃO conta (nunca substitui a etapa anterior).
export type PipelineMovement = {
  from: string | null
  to: string
  count: number
}

export type ConversionStep = { label: string; rate: number }   // ex.: "Lead → Contato"

export type ReportInsight = {
  kind: 'gargalo' | 'melhor_etapa' | 'pior_etapa' | 'no_show' | 'queda_conversao'
  message: string
}

// Ranking/gargalo por fase do funil.
export type StageRanking = { stage: string; count: number; avgDays: number | null }

export type CommercialReport = {
  period: ReportPeriod
  kpis: ReportKpis
  movements: PipelineMovement[]
  conversions: ConversionStep[]
  funnel: StageRanking[]
  stuckLeads: number
  insights: ReportInsight[]
}
