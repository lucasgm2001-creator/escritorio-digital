'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Só revalida quando a aba VOLTA de escondida (visibilitychange hidden→visible) E ficou
// escondida por mais de 60s. NÃO escuta o 'focus' do window (barulhento: dispara em
// alt-tab/clique de volta) e NÃO usa intervalo periódico — assim o Router Cache do Next
// sobrevive e navegar entre seções volta a ser instantâneo. router.refresh() re-busca os
// server components em segundo plano, sem limpar a tela.
const MIN_HIDDEN_MS = 60_000

export function RevalidateOnFocus() {
  const router = useRouter()
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        return
      }
      // Voltou a ficar visível: só atualiza se ficou escondida tempo suficiente.
      const since = hiddenAt.current
      hiddenAt.current = null
      if (since != null && Date.now() - since >= MIN_HIDDEN_MS) {
        router.refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [router])

  return null
}
