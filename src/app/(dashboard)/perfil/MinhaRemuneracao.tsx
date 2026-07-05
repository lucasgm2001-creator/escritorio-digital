'use client'

import { useState } from 'react'
import { Wallet, ChevronDown, Download } from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { usd, brl } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildMyCompensationPdf } from '@/lib/commercial/my-compensation-pdf'
import type { MyCompensationView } from '@/server/services/MyCompensationService'
import type { PendingClientLine } from '@/lib/commission/types'
import type { CommissionType, PaymentRule } from '@/server/repositories/CompensationRepository'

// "Minha Remuneração" (Perfil) — visão do COLABORADOR (COMPENSATION-REAL-001). Só leitura; os números vêm
// prontos do servidor (MyCompensationService, mesmo motor do módulo real). Estados honestos; nada é calculado
// aqui, nada é editável — configuração vive só em Administração › Remuneração.

const PAYMENT_RULE_LABEL: Record<PaymentRule, string> = {
  weekly_as_client_pays: 'Semanal, conforme o cliente paga',
  next_month_after_completion: 'No mês seguinte à conclusão',
}
function commissionText(c: { enabled: boolean; type: CommissionType; value: number }): string {
  if (!c.enabled) return 'Desativada'
  return c.type === 'percentage' ? `${c.value}%` : usd(c.value)
}
const STATUS_LABEL: Record<string, string> = { em_andamento: 'Em andamento', concluido: 'Concluído', interrompido: 'Interrompido' }

export function MinhaRemuneracao({ vm, workspace }: { vm: MyCompensationView; workspace: string }) {
  const [open, setOpen] = useState<string | null>(vm.months[0]?.key ?? null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const downloadPdf = async () => {
    setPdfLoading(true)
    try { await buildMyCompensationPdf(vm, workspace) } finally { setPdfLoading(false) }
  }

  if (!vm.hasComp) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sem remuneração configurada"
        description="Você ainda não tem um vínculo de remuneração nesta equipe. Quando o gestor configurar seu modelo (salário e comissões) em Administração › Remuneração, ele aparece aqui."
      />
    )
  }

  const rule = vm.rule
  const cur = vm.currentMonth

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-lg text-bento-text">Minha Remuneração</h2>
          <p className="text-[13px] text-bento-muted">
            {vm.cargo ?? 'Cargo não configurado'}{vm.department ? ` · ${vm.department}` : ''} · {vm.sellerName}
          </p>
          <p className="text-[11px] text-bento-dim mt-0.5">
            {vm.status === 'inativo' ? 'Inativo' : 'Ativo'}{vm.lastUpdate ? ` · última atualização ${vm.lastUpdate}` : ''}
          </p>
        </div>
        <button type="button" onClick={downloadPdf} disabled={pdfLoading}
          className="inline-flex items-center gap-1.5 shrink-0 border border-bento-border text-bento-muted hover:border-lime hover:text-bento-text px-3 min-h-[40px] rounded-btn text-[13px] font-medium transition-colors disabled:opacity-50">
          <Download className="w-3.5 h-3.5" />{pdfLoading ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>

      {/* Indicadores (Parte 3) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <MetricCard title="Salário fixo" value={usd(cur?.salaryUsd ?? 0)} size="sm" />
        <MetricCard title="Comissão do mês" value={usd((cur?.meetingsUsd ?? 0) + (cur?.weeksUsd ?? 0))} size="sm" tone="positive" />
        <MetricCard title="Receber esta semana" value={usd(vm.thisWeekUsd)} size="sm" />
        <MetricCard title="Receber este mês" value={usd(cur?.totalUsd ?? 0)} size="sm" />
        <MetricCard title="Próximo pagamento" value={vm.nextPayout?.date ?? '—'} size="sm" tone="muted" />
        <MetricCard title="Comissão acumulada" value={usd(vm.totalReceivedUsd)} size="sm" />
      </div>

      {/* Comissões pendentes — primeiras 4 semanas por cliente (SELLER-COMMISSION-PENDING-001). Reusa o motor:
          os números vêm prontos de vm.pending (pendingCommission → dealTotal). Só exibição, cards compactos. */}
      {vm.pending.lines.length > 0 && (
        <div className="bento-fx p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Comissões pendentes · primeiras 4 semanas</p>
            <span className="text-[11px] text-bento-dim shrink-0">{vm.pending.clientesPendentes} pendente(s) · {vm.pending.clientesCompletos} completo(s)</span>
          </div>

          {vm.pending.clientesPendentes === 0 ? (
            <p className="flex items-center gap-1.5 text-[13px] text-bento-muted">
              <span className="text-lime-fg font-semibold">✓</span> Nenhuma comissão pendente — todos os clientes completaram as 4 semanas.
            </p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Total pendente</p>
                  <p className="font-display text-2xl font-bold text-lime-fg tabular-nums leading-none">{usd(vm.pending.totalPendenteUsd)}</p>
                </div>
                <p className="text-[11px] text-bento-dim text-right shrink-0">
                  {vm.pending.semanasPendentesTotais} semana(s) a receber<br />em {vm.pending.clientesPendentes} cliente(s)
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vm.pending.lines.filter(l => l.situacao === 'pendente').map(l => <PendingCard key={l.dealId} l={l} />)}
              </div>
            </>
          )}

          {vm.pending.clientesCompletos > 0 && (
            <p className="text-[11px] text-bento-dim leading-relaxed">
              <span className="text-bento-muted font-medium">Completaram as 4 semanas:</span>{' '}
              {vm.pending.lines.filter(l => l.situacao === 'completo').map(l => l.clientName || 'Sem nome').join(' · ')}
            </p>
          )}
          {vm.pending.lines.some(l => l.situacao === 'encerrado') && (
            <p className="text-[11px] text-bento-dim leading-relaxed">
              <span className="text-bento-muted font-medium">Encerradas antes das 4 semanas:</span>{' '}
              {vm.pending.lines.filter(l => l.situacao === 'encerrado').map(l => `${l.clientName || 'Sem nome'} (${l.semanasPagas}/${l.semanasElegiveis})`).join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* Modelo (Parte 6) */}
      <div className="bento-fx p-4 space-y-3">
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Meu modelo de remuneração</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
          <Row label="Salário fixo (vigente)" value={usd(cur?.salaryUsd ?? 0)} sub={cur && cur.salaryBrl > 0 ? brl(cur.salaryBrl) : undefined} />
          <Row label="Forma de pagamento" value={rule ? PAYMENT_RULE_LABEL[rule.paymentRule] : 'Não configurado'} />
          <Row label="Comissão por contrato" value={rule ? commissionText(rule.contractCommission) : '—'} />
          <Row label="Comissão por renovação" value={rule ? commissionText(rule.renewalBonus) : '—'} />
          <Row label="Comissão por upgrade" value={rule ? commissionText(rule.upgradeCommission) : '—'} />
          <Row label="Comissão por reunião" value={rule ? commissionText(rule.meetingCommission) : '—'} />
        </div>
        {!rule && <p className="text-[12px] text-bento-dim">Modelo de comissão ainda não configurado — falando com o gestor, ele aparece aqui.</p>}
      </div>

      {/* Histórico mês a mês (Parte 7) */}
      <div className="space-y-2">
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Histórico mês a mês</p>
        {vm.months.length === 0 ? (
          <EmptyState icon={Wallet} title="Sem histórico ainda" description="Seus pagamentos aparecem aqui assim que houver movimentação." />
        ) : (
          vm.months.map(mo => {
            const isOpen = open === mo.key
            return (
              <div key={mo.key} className="bento-fx overflow-hidden">
                <button type="button" onClick={() => setOpen(isOpen ? null : mo.key)}
                  className="w-full flex items-center justify-between gap-2 p-3.5 text-left">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronDown className={cn('w-4 h-4 text-bento-muted transition-transform shrink-0', isOpen && 'rotate-180')} />
                    <span className="text-sm font-semibold text-bento-text capitalize shrink-0">{mo.label}</span>
                    <span className="text-[11px] text-bento-dim truncate">· {mo.summary.weeksCount} semana(s) · {mo.summary.meetingsCount} reunião(ões)</span>
                  </div>
                  <span className="text-sm font-semibold text-bento-text tabular-nums shrink-0">{usd(mo.summary.totalUsd)}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-bento-border divide-y divide-bento-border/60">
                    {mo.payments.length === 0 ? (
                      <p className="text-[12px] text-bento-dim p-3.5">Sem pagamentos neste mês.</p>
                    ) : mo.payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[13px] text-bento-text truncate">{p.origem}{p.cliente ? ` · ${p.cliente}` : ''}</p>
                          <p className="text-[11px] text-bento-dim">{p.data}{p.status ? ` · ${STATUS_LABEL[p.status] ?? p.status}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-medium text-bento-text tabular-nums">{usd(p.valorUsd)}</p>
                          {p.valorBrl > 0 && <p className="text-[10px] text-bento-dim tabular-nums">{brl(p.valorBrl)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <p className="text-[11px] text-bento-dim">
        Valores em USD (moeda base); BRL é exibição pela cotação da data. Histórico imutável — nada é recalculado.
        A configuração do modelo é feita pelo gestor em Administração › Remuneração.
      </p>
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-bento-border/40 last:border-0">
      <span className="text-bento-muted shrink-0">{label}</span>
      <span className="text-bento-text font-medium text-right min-w-0 break-words tabular-nums">{value}{sub && <span className="block text-[11px] text-bento-dim font-normal">{sub}</span>}</span>
    </div>
  )
}

// Card compacto de um cliente com comissão pendente. Progresso pagas/4 + valor que falta + próxima semana.
function PendingCard({ l }: { l: PendingClientLine }) {
  const pct = l.semanasElegiveis > 0 ? Math.min(100, (l.semanasPagas / l.semanasElegiveis) * 100) : 0
  return (
    <div className="bg-bento-bg border border-bento-border/60 rounded-btn p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-bento-text truncate">{l.clientName || 'Venda sem cliente'}</span>
        <span className="font-display text-sm font-bold text-lime-fg tabular-nums flex-none">{usd(l.comissaoPendenteUsd)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-bento-border/50 overflow-hidden">
          <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-tech text-[11px] text-bento-muted tabular-nums flex-none">{l.semanasPagas}/{l.semanasElegiveis} sem.</span>
      </div>
      <p className="mt-1.5 text-[11px] text-bento-dim">
        {l.semanasPendentes} semana(s) × {usd(l.comissaoPorSemanaUsd)}{l.proximaSemana ? ` · próxima: ${l.proximaSemana}ª` : ''}
      </p>
    </div>
  )
}
