'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock3, FileDown, MinusCircle, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  onboardingProgress, numeracao, flattenTopics, type OnboardingStatus, type OnboardingTopic,
} from '@/lib/client/onboarding'
import { saveOnboardingStepAction, clearOnboardingStepAction } from './onboarding-actions'

// ESPELHO do onboarding (ONBOARDING-002 · edição em ONBOARDING-004). O preenchimento AO VIVO acontece no
// Studio, que é a tela compartilhada com o cliente; aqui é a visão da EQUIPE, ao lado do financeiro e da
// timeline que o cliente nunca vê.
//
// Editar aqui também: depois da reunião sempre aparece o dado que faltava (o domínio que o cliente mandou
// por mensagem, a licença que chegou depois). Obrigar a voltar ao Studio para corrigir uma linha seria
// fricção sem motivo. Não há risco de divergir: as duas telas gravam nas MESMAS linhas, pela MESMA
// action — são dois pontos de entrada, não duas fontes.

export type MirrorRow = { step_id: string; status: OnboardingStatus; resposta: string | null }

export function OnboardingMirror({ clientId, clientName, topicos, rows }: {
  clientId: string; clientName: string; topicos: OnboardingTopic[]; rows: MirrorRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState('')
  const ordem = flattenTopics(topicos)
  const num = numeracao(topicos)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const porEtapa = new Map(rows.map(r => [r.step_id, r.status]))
  const resposta = new Map(rows.map(r => [r.step_id, r.resposta]))
  const prog = onboardingProgress(ordem, porEtapa)

  function salvar(stepId: string, status: OnboardingStatus) {
    if (pending) return
    setErro(null)
    startTransition(async () => {
      const r = await saveOnboardingStepAction(clientId, stepId, status, rascunho)
      if (!r.ok) { setErro(r.error); return }
      setEditando(null); router.refresh()
    })
  }

  function limpar(stepId: string) {
    if (pending) return
    setErro(null)
    startTransition(async () => {
      const r = await clearOnboardingStepAction(clientId, stepId)
      if (!r.ok) { setErro(r.error); return }
      setEditando(null); router.refresh()
    })
  }

  async function gerarPdf() {
    if (pdfBusy) return
    setPdfBusy(true); setErro(null)
    try {
      const { buildOnboardingPdf } = await import('@/lib/client/onboarding-pdf')
      await buildOnboardingPdf({
        clientName,
        itens: ordem.map(s => ({
          titulo: `${num.get(s.id) ?? ''} ${s.titulo}`.trim(),
          status: porEtapa.get(s.id) ?? null, resposta: resposta.get(s.id) ?? null,
        })),
      })
    } catch { setErro('Não foi possível gerar o PDF.') } finally { setPdfBusy(false) }
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="bento-fx p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-bento-text">{prog.concluidas} de {prog.total} concluídas</p>
            <p className="font-tech text-caption text-bento-muted">
              {prog.pendentes} pendente(s) · {prog.abertas} não tratada(s) · preenchido no Studio
            </p>
          </div>
          <button type="button" onClick={gerarPdf} disabled={pdfBusy}
            className="inline-flex items-center gap-2 rounded-btn border border-bento-border px-3 min-h-[40px] text-sm font-medium text-bento-dim transition-colors hover:border-lime hover:text-bento-text disabled:opacity-50">
            <FileDown className="h-4 w-4" />{pdfBusy ? 'Gerando…' : 'Gerar PDF'}
          </button>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bento-bg">
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${prog.pct}%` }} />
        </div>
      </div>

      {erro && <p className="rounded-btn border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{erro}</p>}

      <div className="space-y-2">
        {ordem.map(step => {
          const st = porEtapa.get(step.id)
          const txt = resposta.get(step.id)
          return (
            <div key={step.id}
              className={cn('rounded-bento border p-3.5 min-w-0', step.parentId && 'ml-5',
                st === 'concluido' ? 'border-bento-border bg-bento-bg/40'
                  : st === 'pendente' ? 'border-amber-500/40 bg-amber-500/[0.04]'
                    : 'border-bento-border/50 bg-bento-bg/20')}>
              <div className="flex items-start gap-3">
                <span className={cn('grid h-6 min-w-[1.5rem] flex-none place-items-center rounded-full border px-1 font-tech text-[10px]',
                  st === 'concluido' ? 'border-lime bg-lime text-lime-ink'
                    : st === 'pendente' ? 'border-amber-400 text-amber-300'
                      : 'border-bento-border text-bento-muted')}>
                  {st === 'concluido' ? <Check className="h-3.5 w-3.5" />
                    : st === 'pendente' ? <Clock3 className="h-3.5 w-3.5" />
                      : (num.get(step.id) ?? '')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold break-words', st ? 'text-bento-text' : 'text-bento-muted')}>
                    {step.titulo}
                  </p>
                  {txt ? (
                    <p className="mt-1 text-note text-bento-dim whitespace-pre-wrap break-words">{txt}</p>
                  ) : !st ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 font-tech text-caption text-bento-muted">
                      <MinusCircle className="h-3 w-3" /> Não tratada
                    </p>
                  ) : null}
                  {st === 'pendente' && editando !== step.id && (
                    <p className="mt-0.5 inline-flex items-center gap-1 font-tech text-caption text-amber-300">
                      <Clock3 className="h-3 w-3" /> Pendente
                    </p>
                  )}

                  {editando === step.id && (
                    <div className="mt-2 space-y-2">
                      {step.pedeResposta && (
                        <textarea value={rascunho} onChange={e => setRascunho(e.target.value)} rows={2} autoFocus
                          placeholder={step.exemploResposta ?? ''}
                          className="w-full resize-none rounded-btn border border-bento-border bg-bento-bg px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:border-lime focus:outline-none" />
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={() => salvar(step.id, 'concluido')} disabled={pending}
                          className="bento-btn inline-flex items-center gap-1.5 rounded-btn px-3 min-h-[34px] text-xs font-semibold disabled:opacity-50">
                          <Check className="h-3.5 w-3.5" /> Concluído
                        </button>
                        <button type="button" onClick={() => salvar(step.id, 'pendente')} disabled={pending}
                          className="inline-flex items-center gap-1.5 rounded-btn border border-bento-border px-3 min-h-[34px] text-xs text-bento-muted hover:border-amber-400/60 hover:text-amber-300 disabled:opacity-50">
                          <Clock3 className="h-3.5 w-3.5" /> Pendente
                        </button>
                        {st && (
                          <button type="button" onClick={() => limpar(step.id)} disabled={pending}
                            className="rounded-btn border border-bento-border px-3 min-h-[34px] text-xs text-bento-muted hover:text-bento-text disabled:opacity-50">
                            Limpar
                          </button>
                        )}
                        <button type="button" onClick={() => setEditando(null)} aria-label="Cancelar"
                          className="rounded-btn p-1.5 text-bento-muted hover:text-bento-text"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )}
                </div>
                {editando !== step.id && (
                  <button type="button" onClick={() => { setEditando(step.id); setRascunho(txt ?? '') }}
                    disabled={pending} aria-label="Editar etapa"
                    className="flex-none rounded-btn p-1.5 text-bento-muted hover:text-bento-text disabled:opacity-40">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
