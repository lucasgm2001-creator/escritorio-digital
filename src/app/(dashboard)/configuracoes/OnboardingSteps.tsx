'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, CornerDownRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { buildTopics, mapStep, numeracao, STEP_COLUMNS, type OnboardingTopic } from '@/lib/client/onboarding'
import {
  createOnboardingStepAction, updateOnboardingStepAction,
  removeOnboardingStepAction, moveOnboardingStepAction, type StepInput,
} from './onboarding-steps-actions'

// Configuração do ROTEIRO de onboarding (ONBOARDING-003). É aqui que o processo da equipe é definido —
// o Studio só executa o que estiver nesta lista.
//
// Hierarquia de UM nível: tópico e subtópico. O roteiro real usa "3.1" e "10.1/10.2/10.3"; mais níveis
// dariam uma árvore que ninguém consegue reordenar com dois botões.
// A numeração (1, 2, 3, 3.1…) é DERIVADA da ordem, nunca gravada — assim reordenar não deixa buracos.

type Editor = { id: string | null; parentId: string | null } & StepInput
const vazio = (parentId: string | null): Editor => ({
  id: null, parentId, titulo: '', ajuda: '', pedeResposta: false, rotuloResposta: '', exemploResposta: '',
})

const inputCls = 'w-full rounded-btn border border-bento-border bg-bento-bg px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:border-lime focus:outline-none'

export function OnboardingSteps() {
  const supabase = createClient()
  const [topicos, setTopicos] = useState<OnboardingTopic[] | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('onboarding_steps')
      .select(STEP_COLUMNS).eq('ativo', true).order('posicao')
    setTopicos(buildTopics((data ?? []).map(mapStep)))
  }, [supabase])

  useEffect(() => { void carregar() }, [carregar])

  const num = topicos ? numeracao(topicos) : new Map<string, string>()

  function rodar(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErro(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) { setErro(r.error ?? 'Não foi possível concluir.'); return }
      await carregar()
    })
  }

  function salvar() {
    if (!editor) return
    const payload: StepInput = {
      titulo: editor.titulo, ajuda: editor.ajuda, pedeResposta: editor.pedeResposta,
      rotuloResposta: editor.rotuloResposta, exemploResposta: editor.exemploResposta,
      parentId: editor.parentId,
    }
    rodar(async () => {
      const r = editor.id
        ? await updateOnboardingStepAction(editor.id, payload)
        : await createOnboardingStepAction(payload)
      if (r.ok) setEditor(null)
      return r
    })
  }

  if (!topicos) return <p className="text-sm text-bento-muted">Carregando roteiro…</p>

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-note text-bento-muted">
          Estes são os tópicos da reunião de onboarding, na ordem em que aparecem no Studio.
        </p>
        <button type="button" onClick={() => setEditor(vazio(null))}
          className="bento-btn inline-flex items-center gap-1.5 rounded-btn px-3 min-h-[38px] text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> Novo tópico
        </button>
      </div>

      {erro && <p className="rounded-btn border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{erro}</p>}

      <div className="space-y-1.5">
        {topicos.length === 0 && (
          <p className="rounded-bento border border-dashed border-bento-border p-6 text-center text-sm text-bento-muted">
            Nenhum tópico. O Studio vai abrir o onboarding vazio até você criar o primeiro.
          </p>
        )}
        {topicos.map(t => (
          <div key={t.id} className="space-y-1.5">
            <Linha step={t} numero={num.get(t.id) ?? ''} pending={pending}
              onEditar={() => setEditor({ id: t.id, parentId: null, titulo: t.titulo, ajuda: t.ajuda ?? '',
                pedeResposta: t.pedeResposta, rotuloResposta: t.rotuloResposta ?? '', exemploResposta: t.exemploResposta ?? '' })}
              onSub={() => setEditor(vazio(t.id))}
              onMover={d => rodar(() => moveOnboardingStepAction(t.id, d))}
              onRemover={() => rodar(() => removeOnboardingStepAction(t.id))} />
            {t.filhos.map(f => (
              <div key={f.id} className="pl-6">
                <Linha step={f} numero={num.get(f.id) ?? ''} pending={pending} sub
                  onEditar={() => setEditor({ id: f.id, parentId: t.id, titulo: f.titulo, ajuda: f.ajuda ?? '',
                    pedeResposta: f.pedeResposta, rotuloResposta: f.rotuloResposta ?? '', exemploResposta: f.exemploResposta ?? '' })}
                  onMover={d => rodar(() => moveOnboardingStepAction(f.id, d))}
                  onRemover={() => rodar(() => removeOnboardingStepAction(f.id))} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {editor && (
        <div className="bento-fx space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="font-tech text-label uppercase tracking-label text-bento-muted">
              {editor.id ? 'Editar tópico' : editor.parentId ? 'Novo subtópico' : 'Novo tópico'}
            </p>
            <button type="button" onClick={() => setEditor(null)} aria-label="Fechar"
              className="text-bento-muted hover:text-bento-text"><X className="h-4 w-4" /></button>
          </div>

          <label className="block">
            <span className="font-tech text-[10px] uppercase tracking-label text-bento-muted">Título</span>
            <input value={editor.titulo} onChange={e => setEditor(v => v && ({ ...v, titulo: e.target.value }))}
              placeholder="Ex.: Telefone que será usado" className={cn(inputCls, 'mt-1')} autoFocus />
          </label>

          <label className="block">
            <span className="font-tech text-[10px] uppercase tracking-label text-bento-muted">O que decidir <span className="normal-case text-bento-dim">(opcional)</span></span>
            <textarea rows={2} value={editor.ajuda ?? ''} onChange={e => setEditor(v => v && ({ ...v, ajuda: e.target.value }))}
              placeholder="Aparece só enquanto a etapa não foi resolvida." className={cn(inputCls, 'mt-1 resize-none')} />
          </label>

          <button type="button" onClick={() => setEditor(v => v && ({ ...v, pedeResposta: !v.pedeResposta }))}
            className={cn('flex w-full items-center gap-3 rounded-btn border p-3 text-left transition-colors',
              editor.pedeResposta ? 'border-lime bg-lime/10' : 'border-bento-border hover:border-lime/60')}>
            <span className={cn('h-4 w-4 flex-none rounded border', editor.pedeResposta ? 'border-lime bg-lime' : 'border-bento-border')} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-bento-text">Tem campo para escrever</span>
              <span className="block font-tech text-[11px] text-bento-dim">Marque quando a etapa gera uma informação a registrar (domínio, telefone, licença).</span>
            </span>
          </button>

          {editor.pedeResposta && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="font-tech text-[10px] uppercase tracking-label text-bento-muted">Rótulo do campo</span>
                <input value={editor.rotuloResposta ?? ''} onChange={e => setEditor(v => v && ({ ...v, rotuloResposta: e.target.value }))}
                  placeholder="Ex.: Domínio escolhido" className={cn(inputCls, 'mt-1')} />
              </label>
              <label className="block">
                <span className="font-tech text-[10px] uppercase tracking-label text-bento-muted">Exemplo</span>
                <input value={editor.exemploResposta ?? ''} onChange={e => setEditor(v => v && ({ ...v, exemploResposta: e.target.value }))}
                  placeholder="Ex.: cleanpro-orlando.com" className={cn(inputCls, 'mt-1')} />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={salvar} disabled={pending || !editor.titulo.trim()}
              className="bento-btn rounded-btn px-4 min-h-[40px] text-sm font-semibold disabled:opacity-50">
              {pending ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" onClick={() => setEditor(null)}
              className="rounded-btn border border-bento-border px-4 min-h-[40px] text-sm text-bento-muted hover:text-bento-text">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Linha({ step, numero, pending, sub, onEditar, onSub, onMover, onRemover }: {
  step: { id: string; titulo: string; ajuda: string | null; pedeResposta: boolean }
  numero: string; pending: boolean; sub?: boolean
  onEditar: () => void; onSub?: () => void
  onMover: (d: 'cima' | 'baixo') => void; onRemover: () => void
}) {
  return (
    <div className={cn('flex items-start gap-2 rounded-bento border p-3 min-w-0',
      sub ? 'border-bento-border/60 bg-bento-bg/30' : 'border-bento-border bg-bento-bg/50')}>
      {sub && <CornerDownRight className="mt-0.5 h-3.5 w-3.5 flex-none text-bento-muted" />}
      <span className="font-tech text-[11px] text-bento-muted mt-0.5 flex-none tabular-nums">{numero}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-bento-text break-words">{step.titulo}</p>
        {step.ajuda && <p className="text-caption text-bento-muted break-words">{step.ajuda}</p>}
        {step.pedeResposta && <span className="mt-1 inline-block rounded-full border border-lime/30 px-1.5 py-0.5 font-tech text-[9px] uppercase text-lime-fg">campo de texto</span>}
      </div>
      <div className="flex flex-none items-center gap-0.5">
        <button type="button" onClick={() => onMover('cima')} disabled={pending} aria-label="Subir"
          className="rounded-btn p-1.5 text-bento-muted hover:text-bento-text disabled:opacity-40"><ChevronUp className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => onMover('baixo')} disabled={pending} aria-label="Descer"
          className="rounded-btn p-1.5 text-bento-muted hover:text-bento-text disabled:opacity-40"><ChevronDown className="h-3.5 w-3.5" /></button>
        {onSub && (
          <button type="button" onClick={onSub} disabled={pending} title="Adicionar subtópico"
            className="rounded-btn p-1.5 text-bento-muted hover:text-lime-fg disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
        )}
        <button type="button" onClick={onEditar} disabled={pending} aria-label="Editar"
          className="rounded-btn p-1.5 text-bento-muted hover:text-bento-text disabled:opacity-40"><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={onRemover} disabled={pending} aria-label="Remover"
          className="rounded-btn p-1.5 text-bento-muted hover:text-red-400 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}
