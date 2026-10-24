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
  // Aquisição (marketing_investments) — período. null = sem denominador (nunca 0 nem inventado).
  investimento: number            // Σ amount_usd no período (USD)
  cpl: number | null              // investimento ÷ leads recebidos no período
  custoPorReuniao: number | null  // investimento ÷ reuniões realizadas no período
  custoPorVenda: number | null    // investimento ÷ vendas concluídas no período
  roi: number | null              // receitaRecebida ÷ investimento (razão; exibir como multiplicador "Nx")
}
