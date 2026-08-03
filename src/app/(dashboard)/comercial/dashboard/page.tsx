import { redirect } from 'next/navigation'

// A "Visão Geral" (ex-Dashboard Executivo) foi absorvida pela aba "Visão Geral" dentro do Comercial
// (KanbanBoard). Mantém a rota antiga funcionando. investment-actions.ts continua nesta pasta (a aba
// Aquisição do DashboardExecutivo depende dele) — só o PAINEL de rota própria saiu.
export default function ComercialDashboardPage() {
  redirect('/comercial?tab=visao_geral')
}
