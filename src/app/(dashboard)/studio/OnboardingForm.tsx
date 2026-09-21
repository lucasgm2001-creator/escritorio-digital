'use client'

import { useEffect, useState, useTransition } from 'react'
import { AlertTriangle, Check, ChevronLeft, Clock3, CloudUpload, FileDown, Minimize2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/Portal'
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
//
// MODO REUNIÃO (ONBOARDING-005): a tela é compartilhada, então o Studio inteiro — menu lateral, cabeçalho,
// abas, relógios — vira ruído e mostra caminhos que o cliente não deve enxergar. Iniciar a reunião joga só
// o roteiro em tela cheia, por cima de tudo, com saída por ESC ou pelo botão.

export type OnboardingRow = { step_id: string; status: OnboardingStatus; resposta: string | null }

export function OnboardingForm({ clientId, clientName, topicos, rows, onVoltar, reuniao = false, onSairReuniao }: {
  clientId: string
  clientName: string
  topicos: OnboardingTopic[]
  rows: OnboardingRow[]
  onVoltar: () => void
  reuniao?: boolean
  onSairReuniao?: () => void
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
  const [, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  // Confirmação de gravação por etapa. A atualização é otimista (a próxima etapa precisa abrir na hora),
  // então "apareceu recolhida" NÃO é prova de que salvou — só de que o clique foi registrado na tela.
  // `emVoo` = esperando o servidor · `falhou` = servidor recusou. O cabeçalho resume os dois.
  const [emVoo, setEmVoo] = useState<Set<string>>(new Set())
  const [falhou, setFalhou] = useState<Set<string>>(new Set())
  const marca = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string, dentro: boolean) =>
    set(s0 => { const n = new Set(s0); if (dentro) n.add(id); else n.delete(id); return n })

  // ESC sai do modo reunião. Sem isto, em tela cheia não há como voltar a não ser com o mouse.
  useEffect(() => {
    if (!reuniao || !onSairReuniao) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSairReuniao() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reuniao, onSairReuniao])

  const porEtapa = new Map(Array.from(estado, ([k, v]) => [k, v.status]))
  const prog = onboardingProgress(ordem, porEtapa)

  // SEM trava global: antes um `if (pending) return` descartava o clique na próxima etapa enquanto a
  // anterior ainda salvava. Numa reunião rápida isso some com decisões sem avisar ninguém. Cada etapa
  // tem a sua gravação; só a MESMA etapa em voo é ignorada.
  function decidir(stepId: string, status: OnboardingStatus) {
    if (emVoo.has(stepId)) return
    setErro(null)
    const resposta = texto[stepId]?.trim() || null
    // Otimista: na reunião a próxima etapa tem de abrir na hora, sem esperar o servidor.
    setEstado(m => new Map(m).set(stepId, { status, resposta }))
    const decididas = new Set([...estado.keys(), stepId])
    setAberta(proximaEtapaAberta(ordem, decididas))
    marca(setEmVoo, stepId, true); marca(setFalhou, stepId, false)
    startTransition(async () => {
      const r = await saveOnboardingStepAction(clientId, stepId, status, resposta)
      marca(setEmVoo, stepId, false)
      if (!r.ok) {
        // NÃO desfaz mais a decisão: apagar o que a pessoa acabou de marcar no meio da reunião é pior do
        // que mostrar que falhou. A etapa fica marcada como não salva e pode ser reenviada com um clique.
        setErro(r.error)
        marca(setFalhou, stepId, true)
      }
    })
  }

  function reabrir(stepId: string) {
    if (emVoo.has(stepId)) return
    setErro(null)
    setEstado(m => { const n = new Map(m); n.delete(stepId); return n })
    setAberta(stepId)
    marca(setFalhou, stepId, false)
    startTransition(async () => {
      const r = await clearOnboardingStepAction(clientId, stepId)
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

  const corpo = (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {reuniao ? (
            <button type="button" onClick={onSairReuniao}
              className="inline-flex items-center gap-1 font-tech text-caption text-bento-muted hover:text-bento-text">
              <Minimize2 className="h-3 w-3" /> Sair da reunião (ESC)
            </button>
          ) : (
            <button type="button" onClick={onVoltar}
              className="inline-flex items-center gap-1 font-tech text-caption text-bento-muted hover:text-bento-text">
              <ChevronLeft className="h-3 w-3" /> Trocar cliente
            </button>
          )}
          <h2 className="mt-1 font-display text-lg font-bold text-bento-text break-words">{clientName}</h2>
          <p className="font-tech text-caption text-bento-muted">
            {prog.concluidas} de {prog.total} concluídas · {prog.pendentes} pendente(s)
          </p>
          {/* Resposta a "como sei que salvou?": estado da gravação sempre à vista, sem precisar procurar. */}
          <p className={cn('mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-tech text-[10px]',
            falhou.size > 0 ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : emVoo.size > 0 ? 'border-bento-border text-bento-muted'
                : 'border-lime/40 bg-lime/10 text-lime-fg')}>
            {falhou.size > 0 ? <><AlertTriangle className="h-3 w-3" /> {falhou.size} etapa(s) nao salva(s)</>
              : emVoo.size > 0 ? <><CloudUpload className="h-3 w-3 animate-pulse" /> salvando...</>
                : <><Check className="h-3 w-3" /> tudo salvo</>}
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
                falhou.has(step.id) ? 'border-red-500/50 bg-red-500/[0.05]'
                  : estaAberta ? 'border-lime/50 bg-bento-panel'
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
                {/* Por etapa: em voo, falhou, ou nada (= gravado). Silencio aqui significa salvo. */}
                {emVoo.has(step.id) && <CloudUpload className="h-3.5 w-3.5 flex-none animate-pulse text-bento-muted" aria-label="Salvando" />}
                {falhou.has(step.id) && (
                  <button type="button" onClick={() => atual && decidir(step.id, atual.status)}
                    title="Nao salvou - clique para tentar de novo"
                    className="flex-none inline-flex items-center gap-1 rounded-btn border border-red-500/40 px-1.5 py-1 font-tech text-[10px] text-red-300 hover:bg-red-500/10">
                    <AlertTriangle className="h-3 w-3" /> tentar de novo
                  </button>
                )}
                {atual && !estaAberta && (
                  <button type="button" onClick={() => reabrir(step.id)} disabled={emVoo.has(step.id)} title="Reabrir"
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
                    <button type="button" onClick={() => decidir(step.id, 'concluido')} disabled={emVoo.has(step.id)}
                      className="bento-btn inline-flex items-center gap-1.5 rounded-btn px-4 min-h-[40px] text-sm font-semibold disabled:opacity-50">
                      <Check className="h-4 w-4" /> Concluído
                    </button>
                    <button type="button" onClick={() => decidir(step.id, 'pendente')} disabled={emVoo.has(step.id)}
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

      {/* Roteiro sem tópicos: dizer "concluído" seria falso — não há nada para concluir. */}
      {ordem.length === 0 && (
        <p className="rounded-btn border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-note text-amber-200">
          Nenhum tópico configurado. Monte o roteiro em Configurações › Roteiro de onboarding.
        </p>
      )}

      {ordem.length > 0 && aberta === null && (
        <p className="rounded-btn border border-lime/30 bg-lime/[0.06] px-3 py-2.5 text-note text-lime-fg">
          Roteiro concluído. As respostas já estão no Onboarding do workspace — gere o PDF para enviar à equipe.
        </p>
      )}
    </div>
  )

  if (!reuniao) return corpo
  // Tela cheia por cima do app: o compartilhamento mostra só o roteiro.
  return (
    <Portal>
      <div className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain bg-bento-bg">{corpo}</div>
    </Portal>
  )
}
