import { redirect } from 'next/navigation'

// As observações do lead vivem no Diário (caixa de observações). Mantém o link antigo funcionando.
export default async function LeadObservationsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  redirect(`/comercial?lead=${encodeURIComponent(id)}`)
}
