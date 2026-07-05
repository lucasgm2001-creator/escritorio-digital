import type { ReactNode } from 'react'
import { Panel } from '@/components/bento/Panel'
import { MetricCard } from '@/components/ui/MetricCard'
import type { FinancialViewVM } from '@/server/services/FinancialService'

// Painel Financeiro executivo (EXECUTIVE-METRICS-005). SÓ apresentação: todos os números vêm prontos do
// FinancialService (fonte única). Hierarquia: destaque (Recebida ≠ Fechado) → recorrência/carteira →
// recebíveis → evolução → quebras → próximos. Sem tabela gigante; cards com propósito.

const usd = (v: number): string => `US$ ${Math.round(v).toLocaleString('en-US')}`
const fmtBR = (ymd: string): string => { const [, m, d] = ymd.split('-'); return `${d}/${m}` }

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">{children}</p>
}

function BarList({ rows, max }: { rows: { label: string; value: number; sub: string }[]; max: number }) {
  if (rows.length === 0) return <p className="text-[13px] text-bento-muted">Sem receita no período.</p>
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-[12px] mb-1 gap-2">
            <span className="text-bento-text truncate">{r.label} <span className="text-bento-dim">· {r.sub}</span></span>
            <span className="font-tech text-bento-text tabular-nums shrink-0">{usd(r.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-bento-panel overflow-hidden">
            <div className="h-full bg-lime rounded-full" style={{ width: `${Math.min(100, Math.round((r.value / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FinanceiroExecutivo({ vm }: { vm: FinancialViewVM }) {
  const maxEvo = Math.max(1, ...vm.evolucaoMensal.map(e => e.value))
  const maxSeller = Math.max(1, ...vm.receitaPorVendedor.map(s => s.value))
  const maxPlan = Math.max(1, ...vm.receitaPorPlano.map(p => p.value))
  const maxForma = Math.max(1, ...vm.receitaPorForma.map(f => f.value))

  return (
    <div className="space-y-6">
      {/* Destaque — Receita Recebida ≠ Valor Fechado (nunca somados) */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bento-fx p-5">
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Receita Recebida · {vm.periodLabel}</p>
            <p className="font-display text-3xl font-bold text-lime-fg tabular-nums leading-none mt-2">{usd(vm.receitaRecebida)}</p>
            <p className="text-[11px] text-bento-dim mt-1.5">dinheiro no caixa (client_payments)</p>
          </div>
          <div className="bento-fx p-5">
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Valor Fechado · {vm.periodLabel}</p>
            <p className="font-display text-3xl font-bold text-bento-text tabular-nums leading-none mt-2">{usd(vm.valorFechado)}</p>
            <p className="text-[11px] text-bento-dim mt-1.5">contratos fechados (deals) — não é caixa</p>
          </div>
          <div className="bento-fx p-5">
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Receita Prevista</p>
            <p className="font-display text-3xl font-bold text-bento-text tabular-nums leading-none mt-2">{usd(vm.receitaPrevista)}</p>
            <p className="text-[11px] text-bento-dim mt-1.5">cobranças agendadas até o fim do mês</p>
          </div>
        </div>
        <p className="text-[11px] text-bento-dim mt-2 px-0.5"><span className="text-bento-muted font-medium">Receita Recebida ≠ Valor Fechado.</span> Dinheiro recebido nunca é somado a contrato fechado.</p>
      </div>

      {/* Recorrência & carteira */}
      <section className="space-y-2">
        <SectionLabel>Recorrência & carteira</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard title="MRR" value={usd(vm.mrr)} tone="positive" size="sm" />
          <MetricCard title="ARR" value={usd(vm.arr)} size="sm" />
          <MetricCard title="Ticket Médio" value={usd(vm.ticketMedio)} size="sm" />
          <MetricCard title="Receita Semanal" value={usd(vm.receitaSemanal)} size="sm" />
          <MetricCard title="Clientes Ativos" value={vm.clientesAtivos} size="sm" />
          <MetricCard title="Clientes Novos" value={vm.clientesNovos} size="sm" tone={vm.clientesNovos > 0 ? 'positive' : 'default'} />
        </div>
      </section>

      {/* Recebíveis */}
      <section className="space-y-2">
        <SectionLabel>Recebíveis</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          <MetricCard title="Clientes em atraso" value={vm.clientesEmAtraso} size="sm" tone={vm.clientesEmAtraso > 0 ? 'negative' : 'default'} />
          <MetricCard title="Recebimentos pendentes" value={usd(vm.recebimentosPendentesUsd)} size="sm" tone={vm.recebimentosPendentesUsd > 0 ? 'negative' : 'default'} />
          <MetricCard title="Receita Mensal" value={usd(vm.receitaRecebida)} size="sm" tone="emerald" />
        </div>
      </section>

      {/* Evolução mensal — receita recebida (6 meses) */}
      <Panel label="Evolução mensal · receita recebida">
        <div className="flex items-end gap-2 sm:gap-3 pt-2">
          {vm.evolucaoMensal.map(e => (
            <div key={e.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="font-tech text-[9px] text-bento-muted tabular-nums">{Math.round(e.value).toLocaleString('en-US')}</span>
              <div className="w-full max-w-[42px] bg-lime rounded-t-[3px]" style={{ height: `${Math.max(4, Math.round((e.value / maxEvo) * 120))}px` }} />
              <span className="font-tech text-[9px] text-bento-dim whitespace-nowrap">{e.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Quebras de receita recebida (só as que têm dado) */}
      {(vm.receitaPorVendedor.length > 0 || vm.receitaPorPlano.length > 0 || vm.receitaPorForma.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {vm.receitaPorVendedor.length > 0 && (
            <Panel label="Por vendedor"><BarList rows={vm.receitaPorVendedor.map(s => ({ label: s.name, value: s.value, sub: `${s.count} cliente(s)` }))} max={maxSeller} /></Panel>
          )}
          {vm.receitaPorPlano.length > 0 && (
            <Panel label="Por plano"><BarList rows={vm.receitaPorPlano.map(p => ({ label: p.plan, value: p.value, sub: `${p.count} cliente(s)` }))} max={maxPlan} /></Panel>
          )}
          {vm.receitaPorForma.length > 0 && (
            <Panel label="Por forma de pagamento"><BarList rows={vm.receitaPorForma.map(f => ({ label: f.label, value: f.value, sub: `${f.count} cliente(s)` }))} max={maxForma} /></Panel>
          )}
        </div>
      )}

      {/* Próximos recebimentos (régua de cobrança) */}
      {vm.proximosRecebimentos.length > 0 && (
        <Panel label="Próximos recebimentos">
          <div className="space-y-1.5">
            {vm.proximosRecebimentos.map((p, i) => (
              <div key={`${p.client}-${i}`} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="text-bento-text truncate">{p.client}</span>
                <span className="text-bento-dim shrink-0 tabular-nums">{fmtBR(p.dueYMD)} · <span className="text-bento-text font-medium">{usd(p.valor)}</span></span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
