// Modelos de RELATÓRIO (Constituição, Título 4). O PDF NUNCA calcula indicadores — ele consome estes
// modelos, produzidos pelo ReportingService. Fundação: só os contratos.

export type ReportPeriod = { from: string; to: string; label: string }

export type ReportKpis = {
  totalLeads: number
  newLeads: number
  interagiram: number       // leads distintos movidos para a etapa Interagiu no período
  meetingsScheduled: number // leads distintos movidos para Reunião Agendada no período
  meetingsHeld: number      // transições distintas de Reunião Agendada para Proposta em Análise
  noShow: number
  proposals: number         // leads distintos movidos para Proposta em Análise no período
  proposalsInReview: number // compatibilidade: mesmo número de propostas movimentadas no período
  won: number               // transições distintas de Proposta em Análise para uma etapa vencedora
  lost: number
  conversionRate: number   // 0..1
  avgCycleDays: number
  avgTicket: number
  totalValue: number
  // ── secundárias do período (REPORTS-PERIOD-TRUTH-001, Parte 2) ──
  naoInteragiram: number    // leads recebidos no período que NÃO se moveram (coorte de chegada)
  negociosFuturos: number   // movimentações para a etapa "Negócio Futuro" no período
  reagendamentos: number    // movimentações para a etapa "Reagendamento" no período
}

// Funil de MOVIMENTAÇÕES do período: cada número vem de uma mudança real registrada em stage_events.
export type PeriodFunnelStep = { key: 'leads' | 'interagiram' | 'reunioes' | 'propostas' | 'vendas'; label: string; count: number }

// Valores do PERÍODO ANTERIOR (mesma duração, imediatamente antes) para o comparativo (Parte 4).
// Receita recebida e conversão do período anterior vêm do execPrev (ExecutiveMetricsService) — fonte única.
export type ReportComparison = {
  newLeads: number
  interagiram: number
  meetingsScheduled: number
  meetingsHeld: number
  proposals: number
  won: number
  conversionRate: number
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
  cumulativeFunnel: PeriodFunnelStep[]   // leads → interagiram → reuniões → propostas → vendas (movimentações)
  comparison: ReportComparison | null    // Parte 4 — funil do período anterior (mesma duração)
  movements: PipelineMovement[]
  conversions: ConversionStep[]
  funnel: StageRanking[]                 // pipeline ATUAL por etapa (gargalos) — snapshot, não é do período
  stuckLeads: number
  insights: ReportInsight[]
}
