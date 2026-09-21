'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock3, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ONBOARDING_STEPS, onboardingProgress, type OnboardingStatus } from '@/lib/client/onboarding'
import { saveOnboardingStepAction, clearOnboardingStepAction } from './onboarding-actions'

// Checklist da reunião de ONBOARDING (ONBOARDING-001). Feito para ser usado AO VIVO, com o cliente na
// linha: cada etapa é escrever a decisão e bater o martelo em um clique.
//
// Dois desfechos, nunca três: CONCLUÍDO (resolveu — e a resposta fica registrada, ex.: qual domínio) ou
// NÃO CONCLUÍDO, que vira PENDENTE. Etapa ainda não tratada simplesmente não tem linha no banco.
// O texto é salvo junto com o desfecho, num clique só — salvar separado obrigaria a lembrar de salvar
// antes de avançar, e no meio de uma reunião isso se perde.

export type OnboardingRow = { step_key: string; status: OnboardingStatus; resposta: string | null }

export function OnboardingChecklist({ clientId, rows }: { clientId: string; rows: OnboardingRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  const porEtapa = new Map(rows.map(r => [r.step_key, r.status]))
  const respostaSalva = new Map(rows.map(r => [r.step_key, r.resposta ?? '']))
  // Rascunho local por etapa: o que está digitado e ainda não foi decidido.
  const [texto, setTexto] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map(r => [r.step_key, r.resposta ?? ''])))

  const prog = onboardingProgress(porEtapa)

  function decidir(stepKey: string, status: OnboardingStatus) {
    if (pending) return
    setErro(null); setSalvando(stepKey)
    startTransition(async () => {
      const r = await saveOnboardingStepAction(clientId, stepKey, status, texto[stepKey] ?? null)
      setSalvando(null)
      if (!r.ok) { setErro(r.error); return }
      router.refresh()
    })
  }

  function reabrir(stepKey: string) {
    if (pending) return
    setErro(null); setSalvando(stepKey)
    startTransition(async () => {
      const r = await clearOnboardingStepAction(clientId, stepKey)
      setSalvando(null)
      if (!r.ok) { setErro(r.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Progresso: só CONCLUÍDO avança a barra. Pendente é etapa tratada que não resolveu. */}
      <div className="bento-fx p-4 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-lg font-bold text-bento-text">
            {prog.concluidas} de {prog.total} concluídas
          </p>
          <p className="font-tech text-caption text-bento-muted">
            {prog.pendentes} pendente(s) · {prog.abertas} não iniciada(s)
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bento-bg">
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${prog.pct}%` }} />
        </div>
      </div>

      {erro && <p className="rounded-btn border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{erro}</p>}

      <div className="space-y-2.5">
        {ONBOARDING_STEPS.map((step, i) => {
          const status = porEtapa.get(step.key)
          const decidida = status != null
          const ocupada = salvando === step.key
          return (
            <div key={step.key}
              className={cn('bento-fx p-4 space-y-3 min-w-0 transition-colors',
                status === 'concluido' && 'border-lime/40 bg-lime/[0.04]',
                status === 'pendente' && 'border-amber-500/40 bg-amber-500/[0.04]')}>
              <div className="flex items-start gap-3">
                <span className={cn('grid h-6 w-6 flex-none place-items-center rounded-full border font-tech text-[11px]',
                  status === 'concluido' ? 'border-lime bg-lime text-lime-ink'
                    : status === 'pendente' ? 'border-amber-400 text-amber-300'
                      : 'border-bento-border text-bento-muted')}>
                  {status === 'concluido' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-bento-text break-words">{step.titulo}</p>
                  {/* A ajuda só serve até a etapa ser resolvida; depois o que importa é a resposta. */}
                  {!decidida && <p className="text-caption text-bento-muted mt-0.5 break-words">{step.ajuda}</p>}
                  {status === 'pendente' && (
                    <p className="mt-0.5 inline-flex items-center gap-1 font-tech text-caption text-amber-300">
                      <Clock3 className="h-3 w-3" /> Pendente
                    </p>
                  )}
                </div>
                {decidida && (
                  <button type="button" onClick={() => reabrir(step.key)} disabled={pending}
                    title="Reabrir etapa"
                    className="flex-none rounded-btn p-1.5 text-bento-muted transition-colors hover:text-bento-text disabled:opacity-40">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <textarea
                value={texto[step.key] ?? respostaSalva.get(step.key) ?? ''}
                onChange={e => setTexto(t => ({ ...t, [step.key]: e.target.value }))}
                rows={2}
                placeholder={step.exemploResposta}
                className="w-full resize-none rounded-btn border border-bento-border bg-bento-bg px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:border-lime focus:outline-none" />

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => decidir(step.key, 'concluido')} disabled={pending}
                  className={cn('inline-flex items-center gap-1.5 rounded-btn px-3 min-h-[38px] text-xs font-semibold transition-colors disabled:opacity-50',
                    status === 'concluido' ? 'bento-btn' : 'border border-lime/40 text-lime-fg hover:bg-lime/10')}>
                  <Check className="h-3.5 w-3.5" />{ocupada ? 'Salvando…' : 'Concluído'}
                </button>
                <button type="button" onClick={() => decidir(step.key, 'pendente')} disabled={pending}
                  className={cn('inline-flex items-center gap-1.5 rounded-btn border px-3 min-h-[38px] text-xs font-medium transition-colors disabled:opacity-50',
                    status === 'pendente'
                      ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                      : 'border-bento-border text-bento-muted hover:border-amber-400/60 hover:text-amber-300')}>
                  <Clock3 className="h-3.5 w-3.5" /> Não concluído
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
