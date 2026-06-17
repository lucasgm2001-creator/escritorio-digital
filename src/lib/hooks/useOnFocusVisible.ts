'use client'

import { useEffect, useRef } from 'react'

interface Opts {
  /** Ignora chamadas dentro desse intervalo (evita martelar em trocas rápidas de aba). */
  throttleMs?: number
  /** Se setado, também chama em intervalo enquanto a aba está visível. */
  intervalMs?: number
  /** Chama uma vez no mount. */
  immediate?: boolean
}

// Hook reutilizável: chama `cb` quando a aba volta a ter FOCO ou VISIBILIDADE (e,
// opcionalmente, num intervalo suave enquanto visível). Base da revalidação ao focar
// e da reavaliação do tema. Usa ref pra não recriar os listeners a cada render.
export function useOnFocusVisible(cb: () => void, { throttleMs = 0, intervalMs, immediate = false }: Opts = {}) {
  const cbRef = useRef(cb)
  cbRef.current = cb
  const lastRef = useRef(0)

  useEffect(() => {
    const run = () => {
      const now = Date.now()
      if (throttleMs && now - lastRef.current < throttleMs) return
      lastRef.current = now
      cbRef.current()
    }
    const onFocus = () => run()
    const onVisible = () => { if (document.visibilityState === 'visible') run() }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    let id: ReturnType<typeof setInterval> | undefined
    if (intervalMs) id = setInterval(() => { if (document.visibilityState === 'visible') run() }, intervalMs)
    if (immediate) run()

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      if (id) clearInterval(id)
    }
  }, [throttleMs, intervalMs, immediate])
}
