import { Inbox } from 'lucide-react'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { MetricCard } from '@/components/ui/MetricCard'
import { Panel } from '@/components/bento/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { INBOUND_PROVIDERS } from '@/lib/inbound/catalog'
import { InboundProviderCard } from './InboundProviderCard'
import { LeadSourcesCard } from './LeadSourcesCard'

// Central de API · Entrada (INBOUND-001, Part 6/8). Estado VISUAL apenas — nenhum provider ativo, nenhum
// dado real, nenhum endpoint funcional. Reusa WorkspaceHeader/MetricCard/Panel/EmptyState (DS).
const SECURITY_MODEL = [
  'API key', 'Secret token', 'HMAC signature', 'Bearer token', 'IP allowlist',
  'Rate limit', 'Replay protection', 'Request id', 'Timestamp', 'Payload hash', 'Provider signature',
]
const btnDisabled = 'text-[12px] font-semibold text-bento-dim border border-bento-border rounded-btn px-2.5 py-1 min-h-[36px] opacity-70 cursor-not-allowed'

export function InboundCenter() {
  const total = INBOUND_PROVIDERS.length
  return (
    <div className="space-y-6">
      <WorkspaceHeader
        breadcrumb={['Administração', 'Webhooks de Entrada']}
        title="Central de API · Entrada"
        subtitle="A porta de entrada do Escritório Digital: leads e eventos de ferramentas externas. Estrutura pronta — nenhum provider ativo até autorização, chave e mapeamento."
      />

      {/* Indicadores — estado, sem dado real (Part 5). */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <MetricCard title="Providers preparados" value={total} size="sm" />
        <MetricCard title="Endpoints ativos" value={0} size="sm" tone="muted" />
        <MetricCard title="Entregas (24h)" value="—" size="sm" tone="muted" />
        <MetricCard title="Segurança" value="Modelada" size="sm" tone="muted" />
      </div>

      {/* Providers preparados (Part 2). */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Providers de entrada</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {INBOUND_PROVIDERS.map(p => <InboundProviderCard key={p.key} provider={p} />)}
        </div>
      </div>

      {/* Endpoint futuro + Segurança modelada (Parts 3/4). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel label="Endpoint de entrada">
          <div className="space-y-2.5 text-[13px]">
            <div className="flex items-center justify-between gap-2"><span className="text-bento-muted">Método</span><span className="font-tech text-bento-text">POST</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-bento-muted">URL</span><span className="font-tech text-bento-dim truncate">/api/inbound/:provider</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-bento-muted">Status</span><span className="font-tech text-amber-400 uppercase text-[11px]">Endpoint não ativado</span></div>
            <div className="flex items-center gap-2 pt-1">
              <button type="button" disabled className={btnDisabled}>Testar</button>
              <button type="button" disabled className={btnDisabled}>Copiar URL</button>
            </div>
            <p className="text-[11px] text-bento-dim pt-1 leading-relaxed">As rotas respondem <span className="font-tech">501 (não implementado)</span> até haver autorização, chave e mapeamento. Nada grava no banco, nada cria lead.</p>
          </div>
        </Panel>

        <Panel label="Segurança (modelada)">
          <div className="space-y-0">
            {SECURITY_MODEL.map(s => (
              <div key={s} className="flex items-center justify-between gap-3 py-2 border-b border-bento-border/60 last:border-0 text-[13px]">
                <span className="text-bento-text">{s}</span>
                <span className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Modelado</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Registro de entregas — modelo vazio elegante (Part 8). */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Registro de entregas</p>
        <EmptyState
          icon={Inbox}
          title="Nenhuma entrega ainda"
          description="Quando um provider for ativado, cada entrega aparece aqui: provider, data, status (recebido · validado · rejeitado · duplicado · criado · erro · replayed), motivo, lead vinculado, request id e tempo de processamento."
        />
      </div>

      {/* Fontes de Lead (Part 7) — reusável (também pode ir no Comercial). */}
      <LeadSourcesCard />
    </div>
  )
}
