'use client'

import { useRouter } from 'next/navigation'
import { useOnFocusVisible } from '@/lib/hooks/useOnFocusVisible'

// Ao voltar o foco/visibilidade pra aba (e a cada 3 min enquanto visível), re-busca os
// dados do servidor com router.refresh(): reconcilia em segundo plano, SEM limpar a tela
// nem spinner cobrindo tudo. Throttle de 10s evita repetir em trocas rápidas de aba. Não
// dispara no mount (a página acabou de carregar fresca).
export function RevalidateOnFocus() {
  const router = useRouter()
  useOnFocusVisible(() => router.refresh(), { throttleMs: 10_000, intervalMs: 180_000 })
  return null
}
