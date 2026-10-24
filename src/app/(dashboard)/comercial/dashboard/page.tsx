import { redirect } from 'next/navigation'

// A "Visão Geral" (ex-Dashboard Executivo) virou parte da aba "Resultados" do Comercial. Mantém a rota antiga
// funcionando. investment-actions.ts continua nesta pasta: o lançamento de investimento (Aquisição) depende dele.
export default function ComercialDashboardPage() {
  redirect('/comercial?tab=resultados')
}
