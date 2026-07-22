'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows'
import { useRole } from '@/components/auth/RoleProvider'
import { cn } from '@/lib/utils'
import { HubTab } from './HubTab'
import type { Client, Nicho, ClientIntegration } from './types'
import type { ClientFinanceSummary } from '@/server/services/ClientsFinanceSummaryService'
import dynamic from 'next/dynamic'

const FloorLoading = () => <div className="py-16 text-center text-sm text-bento-muted">Carregando…</div>
const IntegracoesTab = dynamic(() => import('./IntegracoesTab').then(m => m.IntegracoesTab), { ssr: false, loading: FloorLoading })
const ClienteDetalhe = dynamic(() => import('./ClienteDetalhe').then(m => m.ClienteDetalhe), { ssr: false, loading: FloorLoading })

type Tab = 'hub' | 'integracoes'

export function ClientesFloor({ initialClients, initialNichos, initialIntegrations, finance = {} }: {
  initialClients: Client[]
  initialNichos: Nicho[]
  initialIntegrations: ClientIntegration[]
  finance?: Record<string, ClientFinanceSummary>   // resumo financeiro por cliente (Parte 5) — só na aba Administração
}) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  useRealtimeRows<Client>('clients', setClients)   // cria/edita/encerra cliente reflete ao vivo
  const [nichos, setNichos] = useState<Nicho[]>(initialNichos)
  const [integrations, setIntegrations] = useState<ClientIntegration[]>(initialIntegrations)
  const [tab, setTab] = useState<Tab>('hub')
  const [detailId, setDetailId] = useState<string | null>(null)
  const role = useRole()

  const upsertInteg = (i: ClientIntegration) =>
    setIntegrations(prev => [...prev.filter(x => x.client_id !== i.client_id), i])
  const onClientUpdated = (c: Client) => setClients(prev => prev.map(x => x.id === c.id ? c : x))

  const detail = detailId ? clients.find(c => c.id === detailId) ?? null : null
  if (detail) {
    return (
      <div className="h-full overflow-y-auto bg-bento-bg font-body">
        <ClienteDetalhe
          key={detail.id}
          client={detail}
          nichos={nichos}
          integration={integrations.find(i => i.client_id === detail.id)}
          onBack={() => setDetailId(null)}
          onUpdated={onClientUpdated}
        />
      </div>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'hub', label: 'Hub' },
    { key: 'integracoes', label: 'Integrações' },
  ]

  return (
    <div className="flex flex-col h-full bg-bento-bg font-body">
      <div className="flex-none bg-bento-bg border-b border-bento-border px-4 sm:px-6 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display font-bold text-bento-text text-lg tracking-tight">Clientes</h1>
          {/* Lixeira (F4) — só o owner. Restaurar / excluir definitivo dos clientes/leads excluídos. */}
          {role === 'owner' && (
            <Link href="/lixeira" className="inline-flex items-center gap-1.5 text-xs text-bento-muted hover:text-bento-text transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Lixeira
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1 mt-3 -mb-px">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === t.key ? 'border-lime text-lime-fg' : 'border-transparent text-bento-muted hover:text-bento-text')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'hub' && (
          <HubTab clients={clients} nichos={nichos} integrations={integrations} finance={finance}
            onOpen={setDetailId} onNichoCreated={(n) => setNichos(prev => [...prev, n])} />
        )}
        {tab === 'integracoes' && (
          <IntegracoesTab clients={clients} integrations={integrations} onChange={upsertInteg} />
        )}
      </div>
    </div>
  )
}
