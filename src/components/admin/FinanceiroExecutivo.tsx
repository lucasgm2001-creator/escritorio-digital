import type { ReactNode } from 'react'
import { Panel } from '@/components/bento/Panel'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import type { FinancialViewVM } from '@/server/services/FinancialService'

// Painel Financeiro executivo (EXECUTIVE-METRICS-005 + OPERATION-CRM-002 + FINAL-POLISH-001). SÓ apresentação:
// tudo vem pronto do FinancialService (fonte única). Agrupado em blocos executivos: RECEITA · CARTEIRA ·
// COBRANÇA · ANÁLISE · AGENDA FINANCEIRA. Responsivo (desktop → MacBook Air 13" → iPad → mobile).

const usd = (v: number): string => `US$ ${Math.round(v).toLocaleString('en-US')}`
const fmtBR = (ymd: string): string => { const [, m, d] = ymd.split('-'); return `${d}/${m}` }

const CHARGE_META: Record<string, { label: string; tone: MetricTone }> = {
  prevista: { label: 'Prevista', tone: 'muted' },
  aguardando: { label: 'Aguardando', tone: 'default' },
  recebida: { label: 'Recebida', tone: 'positive' },
  atrasada: { label: 'Atrasada', tone: 'negative' },
  cancelada: { label: 'Cancelada', tone: 'muted' },
}

// Cabeçalho de GRUPO executivo (maior que a section label — dá a hierarquia de painel premium).
function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="font-tech text-[11px] uppercase tracking-[0.22em] text-bento-muted">{children}</span>
      <span className="flex-1 h-px bg-bento-border/60" />
    </div>
  )
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
  const cobrancas = vm.cobrancasPorEstado.filter(c => c.state !== 'cancelada' || c.count > 0)

  return (
    <div className="space-y-6">
      {/* ═══════════════ RECEITA ═══════════════ */}
      <section className="space-y-2.5">
        <GroupHeader>Receita · {vm.periodLabel}</GroupHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bento-fx p-5">
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Receita Recebida</p>
            <p className="font-display text-3xl xl:text-4xl font-bold text-lime-fg tabular-nums leading-none mt-2">{usd(vm.receitaRecebida)}</p>
            <p className="text-[11px] text-bento-dim mt-1.5">dinheiro no caixa (client_payments)</p>
          </div>
          <div className="bento-fx p-5">
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Receita Prevista</p>
            <p className="font-display text-3xl xl:text-4xl font-bold text-bento-text tabular-nums leading-none mt-2">{usd(vm.receitaPrevista)}</p>
            <p className="text-[11px] text-bento-dim mt-1.5">cobranças agendadas até o fim do mês</p>
          </div>
          <div className="bento-fx p-5">
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Valor Fechado</p>
            <p className="font-display text-3xl xl:text-4xl font-bold text-bento-text tabular-nums leading-none mt-2">{usd(vm.valorFechado)}</p>
            <p className="text-[11px] text-bento-dim mt-1.5">contratos fechados (deals) — não é caixa</p>
          </div>
        </div>
        <p className="text-[11px] text-bento-dim px-0.5"><span className="text-bento-muted font-medium">Receita Recebida ≠ Valor Fechado.</span> Dinheiro recebido nunca é somado a contrato fechado.</p>
      </section>

      {/* ═══════════════ CARTEIRA ═══════════════ */}
      <section className="space-y-2.5">
        <GroupHeader>Carteira</GroupHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <MetricCard title="MRR" value={usd(vm.mrr)} tone="positive" size="sm" />
          <MetricCard title="ARR" value={usd(vm.arr)} size="sm" />
          <MetricCard title="Ticket Médio" value={usd(vm.ticketMedio)} size="sm" />
          <MetricCard title="Receita Semanal" value={usd(vm.receitaSemanal)} size="sm" />
          <MetricCard title="Clientes Ativos" value={vm.clientesAtivos} size="sm" />
          <MetricCard title="Clientes Novos" value={vm.clientesNovos} size="sm" tone={vm.clientesNovos > 0 ? 'positive' : 'default'} />
        </div>
      </section>

      {/* ═══════════════ COBRANÇA ═══════════════ */}
      <section className="space-y-2.5">
        <GroupHeader>Cobrança · cobranças do mês por vencimento</GroupHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {cobrancas.map(c => {
            const meta = CHARGE_META[c.state] ?? { label: c.state, tone: 'default' as MetricTone }
            return <MetricCard key={c.state} title={meta.label} value={usd(c.valor)} subtitle={`${c.count} cobrança(s)`} size="sm" tone={meta.tone} />
          })}
          <MetricCard title="Recebimentos pendentes" value={usd(vm.recebimentosPendentesUsd)} size="sm" tone={vm.recebimentosPendentesUsd > 0 ? 'negative' : 'default'} />
          <MetricCard title="Clientes em atraso" value={vm.clientesEmAtraso} size="sm" tone={vm.clientesEmAtraso > 0 ? 'negative' : 'default'} />
        </div>
        <p className="text-[11px] text-bento-dim px-0.5">Cobrança <span className="text-bento-muted font-medium">Recebida</span> conta pela data de <span className="text-bento-muted font-medium">vencimento</span> (pode diferir da Receita Recebida, que conta pela data do pagamento).</p>
      </section>

      {/* ═══════════════ ANÁLISE ═══════════════ */}
      <section className="space-y-2.5">
        <GroupHeader>Análise</GroupHeader>
        <Panel label="Evolução mensal · receita recebida (6 meses)">
          <div className="flex items-end gap-2 sm:gap-4 pt-2">
            {vm.evolucaoMensal.map(e => (
              <div key={e.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <span className="font-tech text-[10px] text-bento-muted tabular-nums">{Math.round(e.value).toLocaleString('en-US')}</span>
                <div className="w-full max-w-[64px] bg-lime rounded-t-[4px]" style={{ height: `${Math.max(6, Math.round((e.value / maxEvo) * 150))}px` }} />
                <span className="font-tech text-[10px] text-bento-dim whitespace-nowrap">{e.label}</span>
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <Panel label="Por vendedor">
            <BarList rows={vm.receitaPorVendedor.map(s => ({ label: s.name, value: s.value, sub: `${s.count} cliente(s)` }))} max={maxSeller} />
          </Panel>
          <Panel label="Por plano">
            <BarList rows={vm.receitaPorPlano.map(p => ({ label: p.plan, value: p.value, sub: `${p.count} cliente(s)` }))} max={maxPlan} />
          </Panel>
        </div>
        {vm.receitaPorForma.length > 0 && (
          <Panel label="Por forma de pagamento">
            <BarList rows={vm.receitaPorForma.map(f => ({ label: f.label, value: f.value, sub: `${f.count} cliente(s)` }))} max={maxForma} />
          </Panel>
        )}
      </section>

      {/* ═══════════════ AGENDA FINANCEIRA ═══════════════ */}
      {vm.proximosRecebimentos.length > 0 && (
        <section className="space-y-2.5">
          <GroupHeader>Agenda financeira · próximos recebimentos</GroupHeader>
          <Panel label={`Próximos recebimentos${vm.recebimentosPendentesUsd > 0 ? ` · ${usd(vm.recebimentosPendentesUsd)} pendente` : ''}`}>
            <div className="divide-y divide-bento-border/60">
              {vm.proximosRecebimentos.map((p, i) => (
                <div key={`${p.client}-${i}`} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="text-bento-text truncate">{p.client}</span>
                  <div className="flex items-center gap-4 shrink-0 tabular-nums">
                    <span className="text-bento-dim">{fmtBR(p.dueYMD)}</span>
                    <span className="text-bento-text font-medium w-20 text-right">{usd(p.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}
    </div>
  )
}
