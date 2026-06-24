'use client'

import { useEffect, useState } from 'react'
import { timeAgo } from '@/lib/utils'

// Tempo relativo ("há X") renderizado SÓ no cliente: no SSR e no 1º render do cliente mostra um
// placeholder ESTÁVEL (vazio) → o HTML do servidor bate com o do cliente (zero hydration #418/#422).
// Depois do mount, exibe o relativo de verdade (atualiza ao re-renderizar a lista).
export function TimeAgo({ date, className }: { date: string | Date; className?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <span className={className} suppressHydrationWarning>{mounted ? timeAgo(date) : ''}</span>
}
