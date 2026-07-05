import { CalendarDays } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { formatDateBR } from '@/lib/date'
import { Panel } from '@/components/bento/Panel'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import { toPaymentPeriods, monthLabel } from '@/lib/commercial/payment-periods'
import type { ClientFinanceVM } from '@/server/services/ClientFinanceService'

// Financeiro do Cliente — só APRESENTA o view-model do ClientFinanceService. Reusa MetricCard + Panel.
// Parte 4: cliente SEMANAL vê uma linha por semana; cliente MENSAL vê uma linha por mês ("Maio/2026") — o motor
// é o mesmo (client_payments por semana), só a apresentação agrupa (toPaymentPeriods).
const usd = (value: number): string => formatCurrency(value, 'en-US', 'USD')
const dateOrDash = (iso: string | null): string => (iso ? formatDateBR(iso) : '—')

export function ClientFinance({ vm }: { vm: ClientFinanceVM }) {
  const isMensal = vm.periodicidade === 'mensal'
  const periods = toPaymentPeriods(vm.payments, vm.periodicidade)
  const pagos = periods.filter(p => !p.anulado).length
  const kpis: { title: string; value: string; tone?: MetricTone }[] = [
    { title: isMensal ? 'Mensal' : 'Semanal', value: usd(isMensal ? vm.planWeekly * 4 : vm.planWeekly) },
    { title: 'Total recebido', value: usd(vm.totalRecebido), tone: 'emerald' },
    { title: isMensal ? 'Meses pagos' : 'Semanas pagas', value: String(isMensal ? pagos : vm.semanasPagas), tone: 'positive' },
    { title: 'Semanas pendentes', value: String(vm.semanasPendentes), tone: vm.semanasPendentes > 0 ? 'negative' : 'default' },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-tech text-[11px] uppercase tracking-[0.14em] text-lime-fg">Financeiro</p>
        <h1 className="font-display font-bold text-2xl text-bento-text">Recebimentos do cliente</h1>
        <p className="text-sm text-bento-muted">Receita real (client_payments), via serviço — {isMensal ? 'agrupada por mês (cobrança mensal)' : 'por semana'}.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {kpis.map(kpi => <MetricCard key={kpi.title} title={kpi.title} value={kpi.value} tone={kpi.tone} size="lg" />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel label="Próxima cobrança">
          {vm.proximaCobranca && vm.proximaSemana != null ? (
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-4 h-4 text-lime-fg shrink-0" />
              <span className="text-sm text-bento-text">
                {isMensal ? `Competência ${monthLabel(vm.proximaCobranca.slice(0, 7))}` : `Semana ${vm.proximaSemana}`} · {dateOrDash(vm.proximaCobranca)}
              </span>
            </div>
          ) : (
            <p className="text-[13px] text-bento-muted">Sem cobrança agendada (cliente sem data de início ou inativo).</p>
          )}
          {vm.semanasPendentes > 0 && (
            <p className="text-[12px] text-amber-300 mt-2">{vm.semanasPendentes} semana(s) vencida(s) sem registro de recebimento.</p>
          )}
        </Panel>

        <Panel label="Histórico de recebimentos">
          {periods.length === 0 ? (
            <p className="text-[13px] text-bento-muted">{isMensal ? 'Nenhum mês registrado ainda.' : 'Nenhuma semana registrada ainda.'}</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {periods.map(period => (
                <div key={period.key} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-tech text-bento-dim tabular-nums">{period.label} · {dateOrDash(period.paidOn)}</span>
                  <span className="flex items-center gap-2">
                    <span className={cn('font-tech tabular-nums', period.anulado ? 'line-through text-bento-muted' : 'text-bento-text')}>{usd(period.valorUsd)}</span>
                    {period.anulado && <span className="text-[10px] text-red-400 font-semibold">anulad{isMensal ? 'o' : 'a'}</span>}
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
