import { redirect } from 'next/navigation'

// O Hub do Lead (lista + perfil em página própria) saiu: o perfil único do lead é o Diário, aberto dentro do
// Comercial. Mantém a rota antiga funcionando.
export default function LeadIndexPage() {
  redirect('/comercial')
}
