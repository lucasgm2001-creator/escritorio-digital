'use client'

import dynamic from 'next/dynamic'

// Studio é pesado (visualizador/apresentação) — carrega sob demanda (client-only). Funciona em
// DESKTOP e MOBILE: Materiais e Apresentar são responsivos (Apresentar = tela cheia + swipe/toque);
// o Montar é melhor no desktop (aviso leve dentro da aba, sem bloquear nada).
const ApresentacaoTab = dynamic(() => import('../comercial/tabs/ApresentacaoTab').then(m => ({ default: m.ApresentacaoTab })), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-bento-muted font-body">Carregando Studio…</div>,
})

export function StudioGate({ activeTeamId }: { activeTeamId: string | null }) {
  return <ApresentacaoTab activeTeamId={activeTeamId} />
}
