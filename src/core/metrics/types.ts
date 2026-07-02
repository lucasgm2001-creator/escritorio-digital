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
