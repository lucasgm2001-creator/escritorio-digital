import { Fragment } from 'react'
import { ArrowRight } from 'lucide-react'
import { formatDateBR } from '@/lib/date'
import { Panel } from '@/components/bento/Panel'
import type { CustomerBillingProfile, PaymentSyncStatus } from '@/lib/billing/types'

// Cobrança do cliente (CLIENT-005, preparação Stripe). SÓ APRESENTA um CustomerBillingProfile (hoje manual,
// provider desconectado) + documenta o fluxo futuro. Sem Stripe/API/banco. Reusa Panel.
const SYNC_LABEL: Record<PaymentSyncStatus, string> = { nunca: 'Nunca sincronizado', sincronizado: 'Sincronizado', pendente: 'Pendente', erro: 'Erro' }
const FLOW = ['Provedor', 'Pagamento confirmado', 'Financeiro', 'Timeline', 'Dashboard', 'Relatório', 'IA']

export function ClientBilling({ billing }: { billing: CustomerBillingProfile }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Forma de pagamento', value: billing.method?.label ?? 'Manual' },
    { label: 'Provedor', value: billing.provider.type === 'manual' ? 'Manual' : billing.provider.type },
    { label: 'Stripe', value: billing.provider.connected ? 'Conectado' : 'Desconectado · pronto para conectar' },
    { label: 'Última confirmação', value: billing.lastConfirmationAt ? formatDateBR(billing.lastConfirmationAt) : '—' },
    { label: 'Webhook', value: billing.provider.webhookOk ? 'OK' : '—' },
    { label: 'Sincronização', value: SYNC_LABEL[billing.provider.syncStatus] },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <Panel label="Cobrança">
        <div className="divide-y divide-bento-border/60">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="text-[13px] text-bento-muted">{row.label}</span>
              <span className="text-[13px] text-bento-text text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel label="Fluxo futuro (provedor de pagamento)">
        <div className="flex flex-wrap items-center gap-1.5">
          {FLOW.map((step, i) => (
            <Fragment key={step}>
              <span className="text-[12px] text-bento-muted border border-bento-border rounded-btn px-2.5 py-1">{step}</span>
              {i < FLOW.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-bento-dim shrink-0" />}
            </Fragment>
          ))}
        </div>
        <p className="text-[11px] text-bento-dim mt-3 leading-relaxed">
          Quando um provedor (Stripe/Asaas/…) confirmar o pagamento, o Financeiro, a Timeline, o Dashboard e os
          Relatórios atualizam — e um evento vai para IA/Automação. Sem integração nesta fase.
        </p>
      </Panel>
    </div>
  )
}
