'use client'

import { useEffect, useState } from 'react'
import { Monitor } from 'lucide-react'
import { ApresentacaoTab } from '../comercial/tabs/ApresentacaoTab'

/**
 * Studio só faz sentido em tela grande. Fronteira única do projeto: ≥1024px = desktop.
 * Desktop: renderiza o Studio igual a hoje. Mobile (<1024px): mostra um aviso curto e NÃO monta
 * a UI pesada do Studio. Default desktop no SSR/hidratação → desktop fica idêntico (sem flash).
 */
export function StudioGate() {
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  if (!isDesktop) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh] font-body">
        <div className="bento-fx p-6 max-w-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-lime/15 flex items-center justify-center mx-auto">
            <Monitor className="w-6 h-6 text-lime-fg" />
          </div>
          <h2 className="font-display font-bold text-bento-text">Studio no computador</h2>
          <p className="text-sm text-bento-muted">
            O Studio de Apresentação está disponível no computador (tela maior). Abra num desktop para criar e apresentar.
          </p>
        </div>
      </div>
    )
  }
  return <ApresentacaoTab />
}
