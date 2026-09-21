'use client'

import { useEffect, useState } from 'react'
import { Building2, ClipboardList, Phone, Wallet, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { formatPhoneBR } from '@/lib/phone'
import { cadenceOf, cadenceLabel } from '@/lib/commission/billing'

// PREPARAR REUNIÃO de onboarding (ONBOARDING-005) — o mesmo gesto da reunião de fechamento: antes de
// entrar na chamada, ver num lugar só o que já se sabe do cliente.
//
// O que entra aqui é o que muda a conversa: o que ele contratou (plano, valor, cadência), como falar com
// ele, e o histórico de observações — que já reúne o que foi dito quando ainda era lead. Financeiro,
// comissão e timeline ficam de fora de propósito: nada disso ajuda a conduzir o onboarding e esta tela
// antecede a que será compartilhada.

type Dados = {
  company: string | null; phone: string | null; email: string | null; nicho: string | null
  plan_weekly: number | null; billing_every: number | null; billing_unit: string | null
  forma_pagamento: string | null; plano_nome: string | null
}

export function OnboardingPrep({ clientId, clientName, onFechar, onIniciar }: {
  clientId: string
  clientName: string
  onFechar: () => void
  onIniciar: () => void
}) {
  const supabase = createClient()
  const { ref, dialogProps } = useDialog(onFechar)
  const [dados, setDados] = useState<Dados | null>(null)
  const [observacoes, setObservacoes] = useState<{ body: string; created_at: string; created_by_name: string | null }[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [{ data: c }, { data: obs }] = await Promise.all([
        supabase.from('clients')
          .select('company, phone, email, nicho, plan_weekly, billing_every, billing_unit, forma_pagamento, plans(nome)')
          .eq('id', clientId).maybeSingle(),
        supabase.from('entity_observations')
          .select('body, created_at, created_by_name')
          .eq('entity_type', 'client').eq('entity_id', clientId)
          .order('created_at', { ascending: false }).limit(6),
      ])
      if (!vivo) return
      const plano = (c as { plans?: { nome?: string } | null } | null)?.plans
      setDados(c ? { ...(c as unknown as Dados), plano_nome: plano?.nome ?? null } : null)
      setObservacoes((obs ?? []) as typeof observacoes)
      setCarregando(false)
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const cadencia = dados ? cadenceLabel(cadenceOf(dados)) : null
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
            {carregando ? <p className="text-sm text-bento-muted">Carregando…</p> : (
              <>
                <div>
                  <p className="mb-1.5 font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">O que ele contratou</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo Icon={Wallet} rotulo="Plano"
                      valor={dados?.plano_nome ?? (dados?.plan_weekly ? `US$ ${dados.plan_weekly}/sem` : '—')} />
                    <Campo Icon={Wallet} rotulo="Cobrança" valor={cadencia ?? '—'} />
                    <Campo Icon={Building2} rotulo="Nicho" valor={dados?.nicho || '—'} />
                    <Campo Icon={Wallet} rotulo="Pagamento" valor={dados?.forma_pagamento || '—'} />
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
                            {new Date(o.created_at).toLocaleDateString('pt-BR')}
                            {o.created_by_name ? ` · ${o.created_by_name}` : ''}
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
