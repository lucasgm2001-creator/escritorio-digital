import { CalendarDays } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date'
import { Panel } from '@/components/bento/Panel'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import type { ClientFinanceVM } from '@/server/services/ClientFinanceService'

// Financeiro do Cliente — só APRESENTA o view-model do ClientFinanceService. Reusa MetricCard + Panel.
const usd = (value: number): string => formatCurrency(value, 'en-US', 'USD')
const dateOrDash = (iso: string | null): string => (iso ? formatDateBR(iso) : '—')

export function ClientFinance({ vm }: { vm: ClientFinanceVM }) {
  const kpis: { title: string; value: string; tone?: MetricTone }[] = [
    { title: 'Semanal', value: usd(vm.planWeekly) },
    { title: 'Total recebido', value: usd(vm.totalRecebido), tone: 'emerald' },
    { title: 'Semanas pagas', value: String(vm.semanasPagas), tone: 'positive' },
    { title: 'Semanas pendentes', value: String(vm.semanasPendentes), tone: vm.semanasPendentes > 0 ? 'negative' : 'default' },
  ]
  const history = vm.payments.slice().sort((a, b) => b.numeroSemana - a.numeroSemana) // semana mais recente primeiro

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">Financeiro</p>
        <h1 className="font-display font-bold text-2xl text-bento-text">Recebimentos do cliente</h1>
        <p className="text-sm text-bento-muted">Receita por semana (dados reais de client_payments), via serviço — sem cálculo na tela.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {kpis.map(kpi => <MetricCard key={kpi.title} title={kpi.title} value={kpi.value} tone={kpi.tone} size="lg" />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel label="Próxima cobrança">
          {vm.proximaCobranca && vm.proximaSemana != null ? (
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-4 h-4 text-lime-fg shrink-0" />
              <span className="text-sm text-bento-text">Semana {vm.proximaSemana} · {dateOrDash(vm.proximaCobranca)}</span>
            </div>
          ) : (
            <p className="text-[13px] text-bento-muted">Sem cobrança agendada (cliente sem data de início ou inativo).</p>
          )}
          {vm.semanasPendentes > 0 && (
            <p className="text-[12px] text-amber-300 mt-2">{vm.semanasPendentes} semana(s) vencida(s) sem registro de recebimento.</p>
          )}
        </Panel>

        <Panel label="Histórico de recebimentos">
          {history.length === 0 ? (
            <p className="text-[13px] text-bento-muted">Nenhuma semana registrada ainda.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {history.map(payment => (
                <div key={payment.numeroSemana} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-tech text-bento-dim tabular-nums">S{payment.numeroSemana} · {dateOrDash(payment.paidOn)}</span>
                  <span className="flex items-center gap-2">
                    <span className={cn('font-tech tabular-nums', payment.anulado ? 'line-through text-bento-muted' : 'text-bento-text')}>{usd(payment.valorUsd)}</span>
                    {payment.anulado && <span className="text-[10px] text-red-400 font-semibold">anulada</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
