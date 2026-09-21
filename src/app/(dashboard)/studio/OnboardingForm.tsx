'use client'

import { useState, useTransition } from 'react'
import { Check, ChevronLeft, Clock3, FileDown, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  onboardingProgress, proximaEtapaAberta, numeracao, flattenTopics,
  type OnboardingStatus, type OnboardingTopic,
} from '@/lib/client/onboarding'
import { saveOnboardingStepAction, clearOnboardingStepAction } from '@/app/(dashboard)/clientes/[id]/onboarding/onboarding-actions'

// Formulário da reunião de ONBOARDING — roda DENTRO DO STUDIO (ONBOARDING-002).
//
// Por que aqui e não no workspace do cliente: esta é a tela que o cliente vê no compartilhamento. O
// workspace tem financeiro, timeline e comissão ao lado; abrir o roteiro lá transformaria a reunião numa
// caderneta transparente. Aqui só existe o roteiro. O que é preenchido ESPELHA no workspace, que continua
// sendo a visão da equipe.
//
// Abertura PROGRESSIVA: uma etapa por vez. Decidir fecha a atual e abre a próxima sozinha — na reunião,
// olhar dez campos ao mesmo tempo tira o foco de quem está do outro lado da linha. As já decididas ficam
// visíveis e recolhidas (dá para conferir e reabrir); as futuras aparecem apagadas, só como contexto.
//
// Escrever NÃO é obrigatório para avançar, e só algumas etapas têm campo.

export type OnboardingRow = { step_id: string; status: OnboardingStatus; resposta: string | null }

export function OnboardingForm({ clientId, clientName, topicos, rows, onVoltar }: {
  clientId: string
  clientName: string
  topicos: OnboardingTopic[]
  rows: OnboardingRow[]
  onVoltar: () => void
}) {
  // Ordem da reunião: tópico → seus subtópicos → próximo tópico. A numeração (1, 2, 3.1) sai da posição.
  const ordem = flattenTopics(topicos)
  const num = numeracao(topicos)
  const [estado, setEstado] = useState<Map<string, { status: OnboardingStatus; resposta: string | null }>>(
    () => new Map(rows.map(r => [r.step_id, { status: r.status, resposta: r.resposta }])))
  const [texto, setTexto] = useState<Record<string, string>>(
    () => Object.fromEntries(rows.map(r => [r.step_id, r.resposta ?? ''])))
  const [aberta, setAberta] = useState<string | null>(
    () => proximaEtapaAberta(ordem, new Set(rows.map(r => r.step_id))))
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const porEtapa = new Map(Array.from(estado, ([k, v]) => [k, v.status]))
  const prog = onboardingProgress(ordem, porEtapa)

  function decidir(stepKey: string, status: OnboardingStatus) {
    if (pending) return
    setErro(null)
    const resposta = texto[stepKey]?.trim() || null
    // Otimista: na reunião a próxima etapa tem de abrir na hora, sem esperar o servidor.
    setEstado(m => new Map(m).set(stepKey, { status, resposta }))
    const decididas = new Set([...estado.keys(), stepKey])
    setAberta(proximaEtapaAberta(ordem, decididas))
    startTransition(async () => {
      const r = await saveOnboardingStepAction(clientId, stepKey, status, resposta)
      if (!r.ok) {
        setErro(r.error)
        setEstado(m => { const n = new Map(m); n.delete(stepKey); return n })   // desfaz
        setAberta(stepKey)
      }
    })
  }

  function reabrir(stepKey: string) {
    if (pending) return
    setErro(null)
    setEstado(m => { const n = new Map(m); n.delete(stepKey); return n })
    setAberta(stepKey)
    startTransition(async () => {
      const r = await clearOnboardingStepAction(clientId, stepKey)
      if (!r.ok) setErro(r.error)
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
          status: estado.get(s.id)?.status ?? null,
          resposta: estado.get(s.id)?.resposta ?? null,
        })),
      })
    } catch {
      setErro('Não foi possível gerar o PDF.')
    } finally { setPdfBusy(false) }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onVoltar}
            className="inline-flex items-center gap-1 font-tech text-caption text-bento-muted hover:text-bento-text">
            <ChevronLeft className="h-3 w-3" /> Trocar cliente
          </button>
          <h2 className="mt-1 font-display text-lg font-bold text-bento-text break-words">{clientName}</h2>
          <p className="font-tech text-caption text-bento-muted">
            {prog.concluidas} de {prog.total} concluídas · {prog.pendentes} pendente(s)
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

      {erro && <p className="rounded-btn border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{erro}</p>}

      <div className="space-y-2">
        {ordem.map(step => {
          const atual = estado.get(step.id)
          const estaAberta = aberta === step.id
          const futura = !atual && !estaAberta
          return (
            <div key={step.id}
              className={cn('rounded-bento border p-4 transition-colors min-w-0', step.parentId && 'ml-5',
                estaAberta ? 'border-lime/50 bg-bento-panel'
                  : atual?.status === 'concluido' ? 'border-bento-border bg-bento-bg/40'
                    : atual?.status === 'pendente' ? 'border-amber-500/40 bg-amber-500/[0.04]'
                      : 'border-bento-border/50 bg-bento-bg/20')}>
              <div className="flex items-start gap-3">
                <span className={cn('grid h-6 min-w-[1.5rem] flex-none place-items-center rounded-full border px-1 font-tech text-[10px]',
                  atual?.status === 'concluido' ? 'border-lime bg-lime text-lime-ink'
                    : atual?.status === 'pendente' ? 'border-amber-400 text-amber-300'
                      : estaAberta ? 'border-lime text-lime-fg' : 'border-bento-border text-bento-muted')}>
                  {atual?.status === 'concluido' ? <Check className="h-3.5 w-3.5" /> : (num.get(step.id) ?? '')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold break-words',
                    futura ? 'text-bento-muted' : 'text-bento-text')}>{step.titulo}</p>
                  {estaAberta && step.ajuda && <p className="mt-0.5 text-caption text-bento-muted break-words">{step.ajuda}</p>}
                  {/* Recolhida: mostra o que ficou decidido, que é o que interessa depois. */}
                  {atual?.resposta && !estaAberta && (
                    <p className="mt-1 text-note text-bento-dim break-words whitespace-pre-wrap">{atual.resposta}</p>
                  )}
                  {atual?.status === 'pendente' && !estaAberta && (
                    <p className="mt-0.5 inline-flex items-center gap-1 font-tech text-caption text-amber-300">
                      <Clock3 className="h-3 w-3" /> Pendente
                    </p>
                  )}
                </div>
                {atual && !estaAberta && (
                  <button type="button" onClick={() => reabrir(step.id)} disabled={pending} title="Reabrir"
                    className="flex-none rounded-btn p-1.5 text-bento-muted hover:text-bento-text disabled:opacity-40">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {estaAberta && (
                <div className="mt-3 space-y-3 pl-9">
                  {/* Campo só nas etapas que têm o que anotar — escrever nunca trava o avanço. */}
                  {step.pedeResposta && (
                    <label className="block">
                      <span className="font-tech text-[10px] uppercase tracking-label text-bento-muted">
                        {step.rotuloResposta ?? 'Resposta'} <span className="normal-case text-bento-dim">(opcional)</span>
                      </span>
                      <textarea
                        value={texto[step.id] ?? ''}
                        onChange={e => setTexto(t => ({ ...t, [step.id]: e.target.value }))}
                        rows={2} autoFocus
                        placeholder={step.exemploResposta ?? ''}
                        className="mt-1 w-full resize-none rounded-btn border border-bento-border bg-bento-bg px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:border-lime focus:outline-none" />
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => decidir(step.id, 'concluido')} disabled={pending}
                      className="bento-btn inline-flex items-center gap-1.5 rounded-btn px-4 min-h-[40px] text-sm font-semibold disabled:opacity-50">
                      <Check className="h-4 w-4" /> Concluído
                    </button>
                    <button type="button" onClick={() => decidir(step.id, 'pendente')} disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-bento-border px-4 min-h-[40px] text-sm font-medium text-bento-muted transition-colors hover:border-amber-400/60 hover:text-amber-300 disabled:opacity-50">
                      <Clock3 className="h-4 w-4" /> Não concluído
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {aberta === null && (
        <p className="rounded-btn border border-lime/30 bg-lime/[0.06] px-3 py-2.5 text-note text-lime-fg">
          Roteiro concluído. As respostas já estão no Onboarding do workspace — gere o PDF para enviar à equipe.
        </p>
      )}
    </div>
  )
}
