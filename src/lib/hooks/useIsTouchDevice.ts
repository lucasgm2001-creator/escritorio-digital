'use client'

import { useEffect, useState } from 'react'

// Detecta dispositivo de TOUCH (ponteiro grosso) — iPad/celular (IPAD-FUNNEL-001). Default false (SSR-safe),
// resolve no mount. NÃO depende só de largura: um iPad Pro landscape (>=1024px) é "desktop" pela largura,
// mas é touch — e é justamente onde o drag acidental acontece.
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setIsTouch(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isTouch
}
