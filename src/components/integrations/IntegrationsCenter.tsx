'use client'

import { useState } from 'react'
import {
  LayoutGrid, Megaphone, Users, CreditCard, MessageCircle, Sparkles, Workflow, Webhook, ScrollText, Activity,
  type LucideIcon,
} from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { Panel } from '@/components/bento/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { IntegrationGrid } from './IntegrationGrid'
import { providersByDomain } from '@/lib/integrations/catalog'
import { getIntegrationOverview } from '@/lib/integrations/overview'
import { HEALTH_STATES, HEALTH_TONE_CLASS, healthMeta } from '@/lib/integrations/health'
import { LOG_COLUMNS } from '@/lib/integrations/logs'
import { WEBHOOK_COLUMNS } from '@/lib/integrations/webhooks'
import type { IntegrationDomain } from '@/lib/integrations/types'
import { cn } from '@/lib/utils'

// Central de Integrações (INT-001) — visão por PROVIDER, provider-agnostic. Só leitura/estado; NADA conecta,
// nenhuma API é chamada. As abas de domínio filtram o catálogo; Webhooks/Logs/Saúde são modelos honestos
// (vazios) que COEXISTEM com /admin/inbound, /admin/logs e o Event Bus — sem os reescrever.

type TabKey = 'overview' | IntegrationDomain | 'logs' | 'health'

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutGrid },
  { key: 'marketing', label: 'Marketing', icon: Megaphone },
  { key: 'crm', label: 'CRM', icon: Users },
  { key: 'finance', label: 'Financeiro', icon: CreditCard },
  { key: 'communication', label: 'Comunicação', icon: MessageCircle },
  { key: 'ai', label: 'IA', icon: Sparkles },
  { key: 'automation', label: 'Automação', icon: Workflow },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook },
  { key: 'logs', label: 'Logs', icon: ScrollText },
  { key: 'health', label: 'Saúde', icon: Activity },
]

const DOMAIN_KEYS: IntegrationDomain[] = ['marketing', 'crm', 'finance', 'communication', 'ai', 'automation', 'webhooks']
const isDomain = (k: TabKey): k is IntegrationDomain => (DOMAIN_KEYS as string[]).includes(k)

export function IntegrationsCenter() {
  const [tab, setTab] = useState<TabKey>('overview')
  const overview = getIntegrationOverview()
  const health = healthMeta(overview.health)

  return (
    <div className="space-y-5">
      {/* Barra de abas — rolagem horizontal no mobile (Linear/Stripe). */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1 border-b border-bento-border min-w-max">
          {TABS.map(t => {
            const active = t.key === tab
            return (
              <button
                key={t.key} type="button" onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap min-h-[40px]',
                  active ? 'border-bento-text text-bento-text' : 'border-transparent text-bento-muted hover:text-bento-text',
                )}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Visão Geral ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <MetricCard title="Disponíveis" value={overview.totalProviders} size="sm" />
            <MetricCard title="Ativas (atuais)" value={overview.connected} size="sm" tone={overview.connected > 0 ? 'positive' : 'muted'} />
            <MetricCard title="Desconectadas" value={overview.disconnected} size="sm" tone="muted" />
            <MetricCard title="Com erro" value={overview.errors} size="sm" tone="muted" />
            <MetricCard title="Eventos recebidos" value={overview.eventsReceived} size="sm" tone="muted" />
            <MetricCard title="Saúde geral" value={health.label} size="sm" tone="muted" />
          </div>

          <Panel label="Coexistência com o que já roda">
            <p className="text-[13px] text-bento-muted leading-relaxed">
              <span className="text-bento-text">{overview.coexistingProviders.join(' e ')}</span> já operam pelas
              superfícies atuais (Webhooks de Entrada e Conta Google). Esta central ainda não gerencia conexões — a
              fundação está pronta para conectar cada provider quando autorizado. Nada aqui chama API externa.
            </p>
          </Panel>

          <div>
            <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Por categoria</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {overview.byDomain.map(d => (
                <button
                  key={d.domain} type="button" onClick={() => setTab(d.domain)}
                  className="bento-fx p-3 text-left transition-colors hover:bg-bento-surface/30"
                >
                  <p className="text-sm font-semibold text-bento-text">{d.label}</p>
                  <p className="text-[11px] text-bento-dim mt-0.5">{d.total} provider{d.total === 1 ? '' : 's'}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Abas de domínio (grades de providers) ── */}
      {isDomain(tab) && (
        <div className="space-y-4">
          <IntegrationGrid providers={providersByDomain(tab)} />

          {/* Webhooks: modelo de gestão de endpoints (vazio honesto). */}
          {tab === 'webhooks' && (
            <div>
              <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Endpoints</p>
              <div className="hidden sm:grid grid-cols-6 gap-2 px-3 pb-2 text-[10px] font-tech uppercase tracking-wide text-bento-dim border-b border-bento-border">
                {WEBHOOK_COLUMNS.map(c => <span key={c}>{c}</span>)}
              </div>
              <EmptyState
                icon={Webhook}
                title="Nenhum webhook configurado"
                description="O webhook de entrada do Magnetic já opera em /api/leads/inbound (veja Webhooks de Entrada). Novos endpoints — entrada ou saída — aparecem aqui quando configurados: endpoint, status, secret, última chamada, último erro e quantidade."
              />
            </div>
          )}
        </div>
      )}

      {/* ── Logs (modelo vazio honesto) ── */}
      {tab === 'logs' && (
        <div>
          <div className="hidden sm:grid grid-cols-7 gap-2 px-3 pb-2 text-[10px] font-tech uppercase tracking-wide text-bento-dim border-b border-bento-border">
            {LOG_COLUMNS.map(c => <span key={c}>{c}</span>)}
          </div>
          <EmptyState
            icon={ScrollText}
            title="Nenhum log ainda"
            description="Cada chamada ou entrega de um provider ativo aparece aqui: hora, provider, ação, resultado, tempo, erro e um resumo do payload (nunca o payload cru). Complementa os Logs técnicos gerais da Administração."
          />
        </div>
      )}

      {/* ── Saúde (arquitetura dos 7 estados) ── */}
      {tab === 'health' && (
        <div className="space-y-4">
          <Panel label="Saúde geral">
            <p className="text-[13px] text-bento-muted leading-relaxed">
              Estado atual: <span className="text-bento-text font-semibold">{health.label}</span> — {health.description}
            </p>
          </Panel>
          <div>
            <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Estados monitorados</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {HEALTH_STATES.map(h => (
                <div key={h.state} className="bento-fx p-3 flex items-start gap-3">
                  <span className={cn('mt-0.5 text-[9px] font-tech uppercase tracking-wide rounded-full border px-1.5 py-0.5 shrink-0', HEALTH_TONE_CLASS[h.tone])}>{h.label}</span>
                  <p className="text-[12px] text-bento-muted leading-relaxed">{h.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
