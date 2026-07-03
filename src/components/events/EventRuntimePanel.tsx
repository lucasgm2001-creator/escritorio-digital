'use client'

import { useState, useEffect, useCallback } from 'react'
import { Zap } from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import { MetricCard } from '@/components/ui/MetricCard'
import { eventBus, publishSystemTest, registerSystemTestSubscriber } from '@/lib/events/runtime'
import type { DomainEvent } from '@/lib/events/types'

// Painel do RUNTIME do Event Bus (EVENT-002, Parts 5/6/7/12). Tudo em memória, no cliente (por aba). Registra
// o subscriber de exemplo no mount e o REMOVE no cleanup (Part 9 — sem vazamento). O botão publica system.test
// (Part 6) → o SystemTestSubscriber recebe (Part 7) → a lista atualiza. Nenhum módulo real reage; nada persiste.
export function EventRuntimePanel() {
  const [recent, setRecent] = useState<DomainEvent[]>([])
  const [subs, setSubs] = useState<{ id: string; module: string; types: string[] }[]>([])

  const refresh = useCallback(() => {
    setRecent(eventBus.getRecentEvents())
    setSubs(eventBus.getSubscribers())
  }, [])

  useEffect(() => {
    const id = registerSystemTestSubscriber(eventBus, () => refresh())
    refresh()
    return () => { eventBus.unsubscribe(id) }   // remove de verdade (Part 9)
  }, [refresh])

  const onPublish = () => {
    publishSystemTest(eventBus, { teamId: 'local', userId: null, requestId: null })
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <MetricCard title="Runtime" value="Ativo" size="sm" tone="positive" />
        <MetricCard title="Buffer" value="Em memória" size="sm" tone="muted" />
        <MetricCard title="Subscribers" value={subs.length} size="sm" />
        <MetricCard title="Eventos no buffer" value={recent.length} size="sm" />
      </div>

      <Panel
        label="Runtime do barramento"
        action={
          <button type="button" onClick={onPublish}
            className="bento-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" /> Publicar evento de teste
          </button>
        }
      >
        <p className="text-[12px] text-bento-muted mb-4">
          Runtime em memória (evento <span className="font-tech">system.test</span>). Demonstração — nenhum módulo real reage e nada é persistido.
        </p>

        <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1.5">Subscribers registrados</p>
        {subs.length === 0 ? (
          <p className="text-[13px] text-bento-muted mb-4">Nenhum subscriber registrado.</p>
        ) : (
          <div className="space-y-1.5 mb-4">
            {subs.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2 bento-fx p-2.5">
                <span className="text-[13px] text-bento-text truncate">{s.module}</span>
                <span className="font-tech text-[10px] text-bento-dim shrink-0">{s.types.join(', ')}</span>
              </div>
            ))}
          </div>
        )}

        <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1.5">Últimos eventos</p>
        {recent.length === 0 ? (
          <p className="text-[13px] text-bento-muted">Nenhum evento publicado.</p>
        ) : (
          <div className="space-y-1.5">
            {recent.slice(0, 10).map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 bento-fx p-2.5">
                <span className="font-tech text-[12px] text-bento-text truncate">{e.type}</span>
                <span className="font-tech text-[10px] text-bento-dim shrink-0 tabular-nums">{e.metadata.emittedAt.slice(11, 19)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
