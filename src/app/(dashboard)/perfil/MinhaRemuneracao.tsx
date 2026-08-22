'use client'

import { useState } from 'react'
import { Wallet, ChevronDown, Download } from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { usd, brl } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildMyCompensationPdf } from '@/lib/commercial/my-compensation-pdf'
import type { CompSource, MyCompensationView } from '@/server/services/MyCompensationService'
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
  // Card aberto: cada indicador mostra a PROCEDÊNCIA (as linhas que o compõem). Clicar de novo fecha.
  const [fonte, setFonte] = useState<string | null>(null)
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-lg text-bento-text">Minha Remuneração</h2>
          <p className="text-note text-bento-muted">
            {vm.cargo ?? 'Cargo não configurado'}{vm.department ? ` · ${vm.department}` : ''} · {vm.sellerName}
          </p>
          <p className="text-caption text-bento-dim mt-0.5">
            {vm.status === 'inativo' ? 'Inativo' : 'Ativo'}{vm.lastUpdate ? ` · última atualização ${vm.lastUpdate}` : ''}
          </p>
        </div>
        <button type="button" onClick={downloadPdf} disabled={pdfLoading}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 shrink-0 border border-bento-border text-bento-muted hover:border-lime hover:text-bento-text px-3 min-h-[42px] rounded-btn text-note font-medium transition-colors disabled:opacity-50">
          <Download className="w-3.5 h-3.5" />{pdfLoading ? 'Gerando…' : 'Baixar PDF'}
        </button>
      </div>

      {/* Indicadores (Parte 3) — cada card ABRE a procedência do próprio número (COMP-FONTES-001).
          O valor exibido continua vindo pronto do servidor; a lista abaixo deriva das MESMAS fontes. */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
        {vm.sources.map(src => (
          <MetricCard
            key={src.key}
            title={src.title}
            value={usd(src.totalUsd)}
            size="sm"
            tone={src.key === 'mesComissao' ? 'positive' : src.key === 'previsto' ? 'muted' : 'default'}
            subtitle={fonte === src.key ? 'ocultar detalhe' : 'ver de onde vem'}
            onClick={() => setFonte(f => f === src.key ? null : src.key)}
          />
        ))}
        <MetricCard title="Próximo pagamento" value={vm.nextPayout?.date ?? '—'} size="sm" tone="muted"
          subtitle={`${usd(vm.nextPayout?.totalUsd ?? 0)} previsto`} />
      </div>

      {fonte && <SourcePanel src={vm.sources.find(x => x.key === fonte)!} onClose={() => setFonte(null)} />}

      {/* Comissões pendentes — primeiras 4 semanas por cliente (SELLER-COMMISSION-PENDING-001). Reusa o motor:
          os números vêm prontos de vm.pending (pendingCommission → dealTotal). Só exibição, cards compactos. */}
      {vm.pending.lines.length > 0 && (
        <div className="bento-fx p-4 sm:p-5 space-y-4">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-tech text-label uppercase tracking-label text-bento-muted">Comissões pendentes · primeiras 4 semanas</p>
            <span className="text-caption text-bento-dim shrink-0">{vm.pending.clientesPendentes} pendente(s) · {vm.pending.clientesCompletos} completo(s)</span>
          </div>

          {vm.pending.clientesPendentes === 0 ? (
            <p className="flex items-center gap-1.5 text-note text-bento-muted">
              <span className="text-lime-fg font-semibold">✓</span> Nenhuma comissão pendente — todos os clientes completaram as 4 semanas.
            </p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-tech text-label uppercase tracking-wide text-bento-muted">Total pendente</p>
                  <p className="font-display text-2xl font-bold text-lime-fg tabular-nums leading-none">{usd(vm.pending.totalPendenteUsd)}</p>
                </div>
                <p className="text-caption text-bento-dim text-right shrink-0">
                  {vm.pending.semanasPendentesTotais} semana(s) a receber<br />em {vm.pending.clientesPendentes} cliente(s)
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vm.pending.lines.filter(l => l.situacao === 'pendente').map(l => <PendingCard key={l.dealId} l={l} />)}
              </div>
            </>
          )}

          {vm.pending.clientesCompletos > 0 && (
            <p className="text-caption text-bento-dim leading-relaxed">
              <span className="text-bento-muted font-medium">Completaram as 4 semanas:</span>{' '}
              {vm.pending.lines.filter(l => l.situacao === 'completo').map(l => l.clientName || 'Sem nome').join(' · ')}
            </p>
          )}
          {vm.pending.lines.some(l => l.situacao === 'encerrado') && (
            <p className="text-caption text-bento-dim leading-relaxed">
              <span className="text-bento-muted font-medium">Encerradas antes das 4 semanas:</span>{' '}
              {vm.pending.lines.filter(l => l.situacao === 'encerrado').map(l => `${l.clientName || 'Sem nome'} (${l.semanasPagas}/${l.semanasElegiveis})`).join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* Modelo (Parte 6) */}
      <div className="bento-fx p-4 sm:p-5 space-y-4">
        <p className="font-tech text-label uppercase tracking-label text-bento-muted">Meu modelo de remuneração</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-note">
          <Row label="Salário fixo (vigente)" value={usd(cur?.salaryUsd ?? 0)} sub={cur && cur.salaryBrl > 0 ? brl(cur.salaryBrl) : undefined} />
          <Row label="Forma de pagamento" value={rule ? PAYMENT_RULE_LABEL[rule.paymentRule] : 'Não configurado'} />
          <Row label="Comissão por contrato" value={rule ? commissionText(rule.contractCommission) : '—'} />
          <Row label="Comissão por renovação" value={rule ? commissionText(rule.renewalBonus) : '—'} />
          <Row label="Comissão por upgrade" value={rule ? commissionText(rule.upgradeCommission) : '—'} />
          <Row label="Comissão por reunião" value={rule ? commissionText(rule.meetingCommission) : '—'} />
        </div>
        {!rule && <p className="text-xs text-bento-dim">Modelo de comissão ainda não configurado — falando com o gestor, ele aparece aqui.</p>}
      </div>

      {/* Histórico mês a mês (Parte 7) */}
      <div className="space-y-2">
        <p className="font-tech text-label uppercase tracking-label text-bento-muted">Histórico mês a mês</p>
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
                    <span className="text-caption text-bento-dim truncate">· {mo.summary.salesWeeksCount} semana(s) de venda · {mo.summary.meetingsCount} reunião(ões)</span>
                  </div>
                  <span className="text-sm font-semibold text-bento-text tabular-nums shrink-0">{usd(mo.summary.totalUsd)}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-bento-border divide-y divide-bento-border/60">
                    {mo.payments.length === 0 ? (
                      <p className="text-xs text-bento-dim p-3.5">Sem pagamentos neste mês.</p>
                    ) : mo.payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="text-note text-bento-text truncate">{p.origem}{p.cliente ? ` · ${p.cliente}` : ''}</p>
                          <p className="text-caption text-bento-dim">{p.data}{p.status ? ` · ${STATUS_LABEL[p.status] ?? p.status}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-note font-medium text-bento-text tabular-nums">{usd(p.valorUsd)}</p>
                          {p.valorBrl > 0 && <p className="text-label text-bento-dim tabular-nums">{brl(p.valorBrl)}</p>}
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

      <p className="text-caption text-bento-dim">
        Valores em USD (moeda base); BRL é exibição pela cotação da data. Histórico imutável — nada é recalculado.
        A configuração do modelo é feita pelo gestor em Administração › Remuneração.
      </p>
    </div>
  )
}

// Painel de PROCEDÊNCIA de um indicador. Só exibição: as linhas vêm prontas do servidor, derivadas das
// mesmas fontes que produziram o número do card — se divergissem, seria bug de dupla contagem.
function SourcePanel({ src, onClose }: { src: CompSource; onClose: () => void }) {
  return (
    <div className="bento-fx p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-tech text-label uppercase tracking-label text-bento-muted">{src.title} · de onde vem</p>
          <p className="text-note text-bento-dim mt-1">{src.description}</p>
        </div>
        <button type="button" onClick={onClose}
          className="shrink-0 rounded-btn border border-bento-border px-2.5 py-1 text-caption text-bento-muted hover:text-bento-text hover:border-lime transition-colors">
          Fechar
        </button>
      </div>

      {src.lines.length === 0 ? (
        <p className="text-note text-bento-muted">{src.emptyMessage}</p>
      ) : (
        <>
          <div className="divide-y divide-bento-border/40">
            {src.lines.map((l, i) => (
              <div key={`${l.label}-${l.cliente ?? ''}-${l.data ?? ''}-${i}`} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-note text-bento-text break-words">{l.label}</p>
                  <p className="text-caption text-bento-muted mt-0.5 break-words">
                    {[l.cliente, l.data, l.hint].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="font-tech text-note text-bento-text tabular-nums shrink-0">{usd(l.valorUsd)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-bento-border pt-2.5">
            <span className="font-tech text-caption uppercase tracking-label text-bento-muted">Total</span>
            <span className="font-display font-bold text-bento-text tabular-nums">{usd(src.totalUsd)}</span>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-bento-border/40 last:border-0">
      <span className="min-w-0 max-w-[58%] break-words text-bento-muted">{label}</span>
      <span className="text-bento-text font-medium text-right min-w-0 break-words tabular-nums">{value}{sub && <span className="block text-caption text-bento-dim font-normal">{sub}</span>}</span>
    </div>
  )
}

// Card compacto de um cliente com comissão pendente. Progresso pagas/4 + valor que falta + próxima semana.
function PendingCard({ l }: { l: PendingClientLine }) {
  const pct = l.semanasElegiveis > 0 ? Math.min(100, (l.semanasPagas / l.semanasElegiveis) * 100) : 0
  return (
    <div className="bg-bento-bg border border-bento-border/60 rounded-btn p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-bento-text truncate">{l.clientName || 'Venda sem cliente'}</span>
        <span className="font-display text-sm font-bold text-lime-fg tabular-nums flex-none">{usd(l.comissaoPendenteUsd)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-bento-border/50 overflow-hidden">
          <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-tech text-caption text-bento-muted tabular-nums flex-none">{l.semanasPagas}/{l.semanasElegiveis} sem.</span>
      </div>
      <p className="mt-1.5 text-caption text-bento-dim">
        {l.semanasPendentes} semana(s) × {usd(l.comissaoPorSemanaUsd)}{l.proximaSemana ? ` · próxima: ${l.proximaSemana}ª` : ''}
      </p>
    </div>
  )
}
