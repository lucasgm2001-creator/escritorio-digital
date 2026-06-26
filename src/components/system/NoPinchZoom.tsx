'use client'

import { useEffect } from 'react'

// iOS Safari IGNORA user-scalable=no/maximum-scale=1 → a pinça ainda dava zoom (header/menus se mexiam).
// Aqui bloqueamos o gesto de zoom do iOS (gesturestart/change/end). NÃO interfere em scroll/pan de um
// dedo (quem cuida disso é o touch-action no CSS). O double-tap-zoom já fica off com user-scalable=no.
export function NoPinchZoom() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', prevent, { passive: false })
    document.addEventListener('gesturechange', prevent, { passive: false })
    document.addEventListener('gestureend', prevent, { passive: false })
    return () => {
      document.removeEventListener('gesturestart', prevent)
      document.removeEventListener('gesturechange', prevent)
      document.removeEventListener('gestureend', prevent)
    }
  }, [])
  return null
}
