import { redirect } from 'next/navigation'

// Tarefas foi absorvido pela Minha Mesa, que hoje é a aba Follow-up do Comercial. Mantém a rota antiga funcionando.
export default function TarefasPage() {
  redirect('/comercial')
}
