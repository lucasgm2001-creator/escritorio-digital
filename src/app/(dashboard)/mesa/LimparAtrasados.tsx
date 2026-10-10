'use client'

import { useMemo, useState } from 'react'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '../tarefas/types'

// MUTIRÃO DE ATRASADOS (MESA-LIMPEZA-001). Eram 112 tarefas atrasadas: trabalhar uma a uma é o que
// levou ao acúmulo, e encerrar tudo em bloco jogaria fora o que ainda vale.
//
// O desenho é REVISAR ANTES, sempre: nada é encerrado sem a pessoa ver a lista e confirmar. Por isso
// não existe "encerrar tudo" direto — existe selecionar um grupo, destravar o que não quer perder, e
// então confirmar com o número na frente.
//
// A divisão é por TEMPO PARADO porque é o que decide o destino: o que venceu há 40 dias quase sempre
// esfriou; o que venceu anteontem ainda é trabalho. Na base real: 1 acima de 60 dias, 38 entre 31 e 60,
// 56 entre 8 e 30, 15 na última semana — ou seja, nenhuma regra automática de "acima de 60" resolveria.

type Grupo = { chave: string; titulo: string; descricao: string; tasks: Task[] }

const diasParados = (task: Task, today: string): number => {
  if (!task.due_date) return 0
  const ms = new Date(`${today}T00:00:00`).getTime() - new Date(`${task.due_date}T00:00:00`).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

export function LimparAtrasados({ tasks, today, busy, onFechar, onConfirmar }: {
  tasks: Task[]
  today: string
  busy: boolean
  onFechar: () => void
  onConfirmar: (ids: string[]) => void
}) {
  const { ref, dialogProps } = useDialog(onFechar)
  // Começa com NADA marcado. Pré-marcar seria decidir pela pessoa justamente no passo em que ela pediu
  // para decidir.
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [aberto, setAberto] = useState<string | null>(null)

  const grupos = useMemo<Grupo[]>(() => {
    const faixas: Grupo[] = [
      { chave: '60', titulo: 'Parado há mais de 60 dias', descricao: 'Quase certamente esfriou.', tasks: [] },
      { chave: '30', titulo: 'Entre 31 e 60 dias', descricao: 'Pouca chance de ainda estar vivo.', tasks: [] },
      { chave: '7', titulo: 'Entre 8 e 30 dias', descricao: 'Vale olhar antes de encerrar.', tasks: [] },
      { chave: '0', titulo: 'Até 7 dias', descricao: 'Ainda é trabalho recente — provavelmente manter.', tasks: [] },
    ]
    for (const task of tasks) {
      const d = diasParados(task, today)
      const faixa = d > 60 ? '60' : d > 30 ? '30' : d > 7 ? '7' : '0'
      faixas.find(f => f.chave === faixa)?.tasks.push(task)
    }
    return faixas.filter(f => f.tasks.length > 0)
  }, [tasks, today])

  const alternar = (id: string) =>
    setMarcadas(atual => { const n = new Set(atual); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const alternarGrupo = (grupo: Grupo) => {
    const todas = grupo.tasks.every(t => marcadas.has(t.id))
    setMarcadas(atual => {
      const n = new Set(atual)
      for (const t of grupo.tasks) { if (todas) n.delete(t.id); else n.add(t.id) }
      return n
    })
  }

  return (
    <Portal>
      <div onClick={onFechar}
        className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div ref={ref} {...dialogProps} aria-labelledby="limpar-title" onClick={e => e.stopPropagation()}
          className="bento-fx flex max-h-[90dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-frame shadow-card-hover sm:max-w-2xl sm:rounded-frame">

          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-bento-border p-5">
            <div className="min-w-0">
              <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-lime-fg">Mutirão</p>
              <h2 id="limpar-title" className="font-display text-base font-bold text-bento-text">
                Limpar atrasados · {tasks.length} tarefa(s)
              </h2>
              <p className="mt-0.5 font-tech text-caption text-bento-muted">
                Marque o que não vale mais. Nada é encerrado antes de você confirmar.
              </p>
            </div>
            <button onClick={onFechar} aria-label="Fechar" className="shrink-0 p-1 text-bento-muted hover:text-bento-text">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">
            {grupos.map(grupo => {
              const marcadasNoGrupo = grupo.tasks.filter(t => marcadas.has(t.id)).length
              const expandido = aberto === grupo.chave
              return (
                <div key={grupo.chave} className="rounded-bento border border-bento-border bg-bento-bg/40">
                  <div className="flex flex-wrap items-center gap-2 p-3">
                    <button type="button" onClick={() => setAberto(expandido ? null : grupo.chave)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronDown className={cn('h-4 w-4 shrink-0 text-bento-muted transition-transform', expandido && 'rotate-180')} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-bento-text">{grupo.titulo}</span>
                        <span className="block font-tech text-caption text-bento-muted">
                          {grupo.tasks.length} tarefa(s) · {grupo.descricao}
                        </span>
                      </span>
                    </button>
                    <span className="font-tech text-caption tabular-nums text-bento-muted">
                      {marcadasNoGrupo}/{grupo.tasks.length}
                    </span>
                    <button type="button" onClick={() => alternarGrupo(grupo)}
                      className="rounded-btn border border-bento-border px-2.5 py-1 font-tech text-caption text-bento-muted transition-colors hover:border-lime hover:text-bento-text">
                      {marcadasNoGrupo === grupo.tasks.length ? 'Desmarcar' : 'Marcar grupo'}
                    </button>
                  </div>

                  {expandido && (
                    <div className="space-y-1 border-t border-bento-border/60 p-2">
                      {grupo.tasks.map(task => (
                        <label key={task.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-btn px-2 py-1.5 hover:bg-bento-bg">
                          <input type="checkbox" checked={marcadas.has(task.id)} onChange={() => alternar(task.id)}
                            className="h-4 w-4 shrink-0 accent-lime" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-bento-text">{task.title}</span>
                            <span className="block font-tech text-caption text-bento-muted">
                              {task.linked_name ?? 'Sem lead'} · {diasParados(task, today)} dia(s) parada
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-bento-border p-4">
            <p className="font-tech text-caption text-bento-muted">
              {marcadas.size === 0 ? 'Nada marcado.' : `${marcadas.size} será(ão) encerrada(s).`}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onFechar}
                className="min-h-[42px] rounded-btn border border-bento-border px-4 text-sm font-medium text-bento-dim transition-colors hover:border-lime">
                Cancelar
              </button>
              <button onClick={() => onConfirmar([...marcadas])} disabled={busy || marcadas.size === 0}
                className="bento-btn min-h-[42px] rounded-btn px-4 text-sm font-semibold disabled:opacity-50">
                {busy ? 'Encerrando…' : `Encerrar ${marcadas.size || ''}`.trim()}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  )
}
