'use client'

import { useEffect, useState } from 'react'
import { Building2, ClipboardList, Phone, Wallet, X } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { formatPhoneBR } from '@/lib/phone'
import { cadenceOf, cadenceLabel } from '@/lib/commission/billing'
import { getOnboardingPrepAction, type PrepDados } from './onboarding-prep-actions'

// PREPARAR REUNIÃO de onboarding (ONBOARDING-005) — o mesmo gesto da reunião de fechamento: antes de
// entrar na chamada, ver num lugar só o que já se sabe do cliente.
//
// O que entra aqui é o que muda a conversa: o que ele contratou (plano, valor, cadência), como falar com
// ele, e o histórico de observações. Financeiro, comissão e timeline ficam de fora de propósito: nada
// disso ajuda a conduzir o onboarding e esta tela antecede a que será compartilhada.
//
// Os dados vêm de uma server action que reusa o getClientObservations — a mesma fonte da aba Observações,
// que resolve o lead de origem e junta os dois históricos. Consultar entity_observations direto daqui
// perdia tudo da fase de lead (257 registros de lead contra 3 de cliente na base).

export function OnboardingPrep({ clientId, clientName, onFechar, onIniciar }: {
  clientId: string
  clientName: string
  onFechar: () => void
  onIniciar: () => void
}) {
  const { ref, dialogProps } = useDialog(onFechar)
  const [dados, setDados] = useState<PrepDados | null>(null)
  const [observacoes, setObservacoes] = useState<{ body: string; createdAt: string; autor: string | null }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    getOnboardingPrepAction(clientId).then(r => {
      if (!vivo) return
      if (!r.ok) setErro(r.error)
      else { setDados(r.dados); setObservacoes(r.observacoes) }
      setCarregando(false)
    })
    return () => { vivo = false }
  }, [clientId])

  const cadencia = dados
    ? cadenceLabel(cadenceOf({ billing_every: dados.billingEvery, billing_unit: dados.billingUnit }))
    : null
  const telefone = formatPhoneBR(dados?.phone)

  return (
    <Portal>
      <div onClick={onFechar}
        className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div ref={ref} {...dialogProps} aria-labelledby="prep-title" onClick={e => e.stopPropagation()}
          className="bento-fx flex max-h-[90dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-frame shadow-card-hover sm:max-w-lg sm:rounded-frame">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-bento-border p-5">
            <div className="min-w-0">
              <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-lime-fg">Preparar onboarding</p>
              <h2 id="prep-title" className="truncate font-display text-base font-bold text-bento-text">{clientName}</h2>
              {dados?.company && <p className="truncate font-tech text-xs text-bento-muted">{dados.company}</p>}
            </div>
            <button onClick={onFechar} aria-label="Fechar" className="shrink-0 p-1 text-bento-muted hover:text-bento-text">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
            {erro && <p className="rounded-btn border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{erro}</p>}
            {carregando ? <p className="text-sm text-bento-muted">Carregando…</p> : (
              <>
                <div>
                  <p className="mb-1.5 font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">O que ele contratou</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo Icon={Wallet} rotulo="Plano"
                      valor={dados?.planoNome ?? (dados?.planWeekly ? `US$ ${dados.planWeekly}/sem` : '—')} />
                    <Campo Icon={Wallet} rotulo="Cobrança" valor={cadencia ?? '—'} />
                    <Campo Icon={Building2} rotulo="Nicho" valor={dados?.nicho || '—'} />
                    <Campo Icon={Wallet} rotulo="Pagamento" valor={dados?.formaPagamento || '—'} />
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Como falar com ele</p>
                  <div className="grid grid-cols-1 gap-2">
                    <Campo Icon={Phone} rotulo="Telefone" valor={telefone ?? '—'} />
                    <Campo Icon={ClipboardList} rotulo="E-mail" valor={dados?.email || '—'} />
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">
                    Observações {observacoes.length > 0 && <span className="text-bento-dim">· {observacoes.length} mais recentes</span>}
                  </p>
                  {observacoes.length === 0 ? (
                    <p className="text-sm text-bento-muted">Sem observações registradas.</p>
                  ) : (
                    <div className="space-y-2">
                      {observacoes.map((o, i) => (
                        <div key={i} className="rounded-btn border border-bento-border bg-bento-bg p-3">
                          <p className="whitespace-pre-wrap break-words text-sm text-bento-dim">{o.body}</p>
                          <p className="mt-1 font-tech text-[10px] text-bento-muted">
                            {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                            {o.autor ? ` · ${o.autor}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-bento-border p-5">
            <button onClick={onFechar}
              className="min-h-[44px] rounded-btn border border-bento-border px-4 py-2 text-sm font-medium text-bento-dim transition-colors hover:border-lime">
              Cancelar
            </button>
            <button onClick={onIniciar} className="bento-btn min-h-[44px] rounded-btn px-4 py-2 text-sm font-semibold">
              Iniciar reunião
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

function Campo({ Icon, rotulo, valor }: { Icon: typeof Wallet; rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-btn border border-bento-border bg-bento-bg p-2.5">
      <p className="flex items-center gap-1 font-tech text-[9px] uppercase tracking-wide text-bento-muted">
        <Icon className="h-3 w-3" /> {rotulo}
      </p>
      <p className="mt-0.5 break-words text-sm text-bento-text">{valor}</p>
    </div>
  )
}
