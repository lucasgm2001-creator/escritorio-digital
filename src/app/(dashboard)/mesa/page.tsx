import { redirect } from 'next/navigation'

// A Minha Mesa virou a aba Follow-up do Comercial (aba inicial). Mantém a rota antiga funcionando
// (favoritos, PWA instalado, links antigos).
export default function MesaPage() {
  redirect('/comercial')
}
