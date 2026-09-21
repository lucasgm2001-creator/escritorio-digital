'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Presentation, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OnboardingLauncher } from './OnboardingLauncher'

// Studio é pesado (visualizador/apresentação) — carrega sob demanda (client-only). Funciona em
// DESKTOP e MOBILE: Materiais e Apresentar são responsivos (Apresentar = tela cheia + swipe/toque);
// o Montar é melhor no desktop (aviso leve dentro da aba, sem bloquear nada).
const ApresentacaoTab = dynamic(() => import('../comercial/tabs/ApresentacaoTab').then(m => ({ default: m.ApresentacaoTab })), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-bento-muted font-body">Carregando Studio…</div>,
})

// O Studio passou a abrigar DUAS reuniões (ONBOARDING-001): Fechamento (apresentar material ao lead) e
// Onboarding (roteiro com o cliente recém-fechado). São momentos diferentes do mesmo funil e começam no
// mesmo lugar. O onboarding em si vive no workspace do cliente — aqui é só o ponto de partida, porque o
// contexto de um cliente que já existe está lá, não aqui.
type Modo = 'fechamento' | 'onboarding'

export function StudioGate({ activeTeamId }: { activeTeamId: string | null }) {
  const [modo, setModo] = useState<Modo>('fechamento')

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex-none border-b border-bento-border bg-bento-bg px-4 py-2.5 sm:px-6">
        <div className="flex gap-1 rounded-btn border border-bento-border bg-bento-bg p-1 w-fit">
          {([['fechamento', 'Fechamento', Presentation], ['onboarding', 'Onboarding', Rocket]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => setModo(k)}
              className={cn('inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium transition-colors',
                modo === k ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {modo === 'fechamento'
          ? <ApresentacaoTab activeTeamId={activeTeamId} />
          : <OnboardingLauncher />}
      </div>
    </div>
  )
}
