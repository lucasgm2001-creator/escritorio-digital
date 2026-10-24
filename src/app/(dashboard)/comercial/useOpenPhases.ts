'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Lembra quais fases do funil ficaram abertas (FUNIL-ABERTAS-001). Antes toda visita começava com tudo
// fechado e era preciso reabrir as mesmas fases. Só preferência de tela: localStorage, sem servidor.
// Desktop e celular guardam em chaves separadas — várias fases abertas no acordeão do celular viram uma
// rolagem enorme, enquanto no desktop elas ficam lado a lado.
export function useOpenPhases(storageKey: string) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const loaded = useRef(false)

  // Grava DEPOIS de ler: este efeito vem antes do de leitura, então na montagem ele ainda vê
  // loaded=false e não sobrescreve o que estava salvo com o conjunto vazio inicial.
  useEffect(() => {
    if (!loaded.current) return
    try { localStorage.setItem(storageKey, JSON.stringify([...open])) } catch { /* ignore */ }
  }, [open, storageKey])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setOpen(new Set(JSON.parse(raw) as string[]))
    } catch { /* storage indisponível: começa tudo fechado, como antes */ }
    loaded.current = true
  }, [storageKey])

  const toggle = useCallback((key: string) => {
    setOpen(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }, [])

  return { open, toggle }
}
