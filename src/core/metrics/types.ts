// Modelos de MÉTRICAS/KPIs (Constituição, Título 4). Hoje vários módulos calculam indicadores por conta
// própria; esta é a estrutura ÚNICA e reutilizável para onde esses cálculos migrarão (de forma aditiva).

export type SalesMetrics = { won: number; totalValue: number; avgTicket: number }
export type CommercialMetrics = { totalLeads: number; openLeads: number; conversionRate: number }
export type FinancialMetrics = { revenueForecast: number; revenueReceived: number }
export type ActivityMetrics = { activities: number; tasksOpen: number; meetingsToday: number }

export type DashboardMetrics = {
  sales: SalesMetrics
  commercial: CommercialMetrics
  financial: FinancialMetrics
  activity: ActivityMetrics
}

// EXECUTIVE-METRICS-001: view-model ÚNICO da camada executiva. Todo dashboard/tela/PDF/IA consome ISTO —
// nenhuma tela calcula. Period-aware (via rangeFor). Definições oficiais no core/metrics/registry.ts.
export type ExecutiveMetricsVM = {
  periodLabel: string
  from: string          // YYYY-MM-DD (início do período)
  to: string            // YYYY-MM-DD (fim do período)
  // Receita (dinheiro real × contrato × previsão) — nunca misturar
  receitaRecebida: number   // client_payments no período (USD)
  valorFechado: number      // deals fechados no período (USD) — contratos, NÃO dinheiro
  receitaPrevista: number   // cobranças agendadas ainda não recebidas até o fim do período (USD)
  // Recorrência (carteira ativa)
  mrr: number               // Σ ativos (semanal × 4)
  arr: number               // MRR × 12
  // Comercial
  ticketMedio: number       // valor fechado ÷ contratos fechados no período
  conversao: number         // % (0..100), respeitando o período
  // Carteira
  clientesAtivos: number
  clientesNovos: number     // entraram no período
  // Quebras
  receitaPorVendedor: { name: string; value: number; count: number }[]
  receitaPorPlano: { plan: string; value: number; count: number }[]
  mrrPorPlano: { plan: string; mrr: number; count: number }[]
}

// View-model da aba Métricas (CRM-RC-002). Tudo calculado no CommercialMetricsService — a UI só apresenta.
// conversao em % (0..100, MESMA fonte do Hall/Dashboard); convReuniao em taxa 0..1. Valores em USD.
export type CommercialMetricsTabVM = {
  periodLabel: string
  kpis: {
    recebidos: number
    fechados: number      // contratos fechados (deals) no período — base do Valor Fechado/Ticket
    conversao: number     // % (0..100) — funnelConversionPct, MESMA definição do Hall/Dashboard
    pipeline: number
    avgTicket: number
    closedValue: number   // Valor Fechado (deals) no período — não é dinheiro recebido
  }
  convReuniao: number     // 0..1 (marco reunião→venda; métrica de funil distinta da Conversão)
  reuniaoBase: number
  fechouBase: number
  funnel: { key: string; count: number; value: number }[]       // ordem de ALL_COLUMNS (estado atual)
  maxCount: number
  stageValues: { key: string; count: number; value: number }[]  // subset com count > 0
  maxStageValue: number
  bySeller: { name: string; value: number; count: number }[]    // ordenado por valor desc
  maxSellerValue: number
  snapshot: { total: number; ativos: number; fechados: number }
  temperature: { hot: number; warm: number; cold: number }
}
