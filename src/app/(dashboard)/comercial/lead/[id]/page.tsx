import { redirect } from 'next/navigation'

// O Hub do Lead saiu: o perfil único é o Diário. /comercial?lead=<id> abre o Diário desse lead no Comercial.
export default async function LeadHubPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  redirect(`/comercial?lead=${encodeURIComponent(id)}`)
}
