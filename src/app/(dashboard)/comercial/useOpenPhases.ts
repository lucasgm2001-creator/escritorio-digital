'use client'

import { useCallback, useEffect, useState } from 'react'

// Lembra quais fases do funil ficaram abertas (FUNIL-ABERTAS-001). Antes toda visita começava com tudo
// fechado e era preciso reabrir as mesmas fases. Só preferência de tela: localStorage, sem servidor.
// Desktop e celular guardam em chaves separadas — várias fases abertas no acordeão do celular viram uma
// rolagem enorme, enquanto no desktop elas ficam lado a lado.
export function useOpenPhases(storageKey: string) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  // ESTADO (não ref): no StrictMode os efeitos rodam duas vezes na montagem; com ref, a 2ª passada já via
  // "carregado" com o conjunto vazio inicial e gravava [] por cima do que estava salvo.
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setOpen(new Set(JSON.parse(raw) as string[]))
    } catch { /* storage indisponível: começa tudo fechado, como antes */ }
    setLoaded(true)
  }, [storageKey])

  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(storageKey, JSON.stringify([...open])) } catch { /* ignore */ }
  }, [open, loaded, storageKey])

  const toggle = useCallback((key: string) => {
    setOpen(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }, [])

  return { open, toggle }
}
