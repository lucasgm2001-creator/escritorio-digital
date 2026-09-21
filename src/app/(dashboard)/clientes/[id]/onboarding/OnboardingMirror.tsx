'use client'

import { useState } from 'react'
import { Check, Clock3, FileDown, MinusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ONBOARDING_STEPS, onboardingProgress, type OnboardingStatus } from '@/lib/client/onboarding'

// ESPELHO do onboarding (ONBOARDING-002). Só LEITURA: o preenchimento acontece no Studio, que é a tela
// compartilhada com o cliente. Aqui é a visão da EQUIPE — o mesmo conteúdo, ao lado do financeiro, da
// timeline e do resto do workspace, que o cliente nunca vê.
// Ter um único ponto de escrita evita a pergunta "qual das duas telas vale?" quando as duas divergirem.

export type MirrorRow = { step_key: string; status: OnboardingStatus; resposta: string | null }

export function OnboardingMirror({ clientName, rows }: { clientName: string; rows: MirrorRow[] }) {
  const [pdfBusy, setPdfBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const porEtapa = new Map(rows.map(r => [r.step_key, r.status]))
  const resposta = new Map(rows.map(r => [r.step_key, r.resposta]))
  const prog = onboardingProgress(porEtapa)

  async function gerarPdf() {
    if (pdfBusy) return
    setPdfBusy(true); setErro(null)
    try {
      const { buildOnboardingPdf } = await import('@/lib/client/onboarding-pdf')
      await buildOnboardingPdf({
        clientName,
        itens: ONBOARDING_STEPS.map(s => ({
          titulo: s.titulo, status: porEtapa.get(s.key) ?? null, resposta: resposta.get(s.key) ?? null,
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
        {ONBOARDING_STEPS.map((step, i) => {
          const st = porEtapa.get(step.key)
          const txt = resposta.get(step.key)
          return (
            <div key={step.key}
              className={cn('rounded-bento border p-3.5 min-w-0',
                st === 'concluido' ? 'border-bento-border bg-bento-bg/40'
                  : st === 'pendente' ? 'border-amber-500/40 bg-amber-500/[0.04]'
                    : 'border-bento-border/50 bg-bento-bg/20')}>
              <div className="flex items-start gap-3">
                <span className={cn('grid h-6 w-6 flex-none place-items-center rounded-full border font-tech text-[11px]',
                  st === 'concluido' ? 'border-lime bg-lime text-lime-ink'
                    : st === 'pendente' ? 'border-amber-400 text-amber-300'
                      : 'border-bento-border text-bento-muted')}>
                  {st === 'concluido' ? <Check className="h-3.5 w-3.5" />
                    : st === 'pendente' ? <Clock3 className="h-3.5 w-3.5" />
                      : i + 1}
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
                  {st === 'pendente' && (
                    <p className="mt-0.5 inline-flex items-center gap-1 font-tech text-caption text-amber-300">
                      <Clock3 className="h-3 w-3" /> Pendente
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
