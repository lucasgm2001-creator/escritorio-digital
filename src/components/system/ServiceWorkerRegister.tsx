'use client'

import { useEffect } from 'react'

// Registra o SW só em produção (em dev o SW atrapalharia o HMR). Sem UI.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => { /* silencioso */ })
  }, [])
  return null
}
