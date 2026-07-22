import { redirect } from 'next/navigation'

// Tarefas foi absorvido pela Minha Mesa. Mantém a rota antiga funcionando.
export default function TarefasPage() {
  redirect('/mesa')
}
