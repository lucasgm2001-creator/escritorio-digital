'use client'
import { useState, useEffect, useRef, type Dispatch, type SetStateAction, type MutableRefObject } from 'react'
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows'
import type { Task } from './types'

// Estado de tarefas VIVO e ÚNICO do Hall (M6): useState(initialTasks) + reconciliação no refresh (merge POR
// CAMPO do A5, que PRESERVA google_event_id/meet_link) + realtime (merge por id) + deletedIds (deleção
// otimista). Elevado pra cá pra Tarefas, Mural e Agenda lerem a MESMA fonte — concluir/excluir reflete em
// todas na hora, sem esperar refresh. NÃO regride o A5.
export interface TasksState {
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[]>>
  deletedIds: MutableRefObject<Set<string>>
}

export function useTasksState(initialTasks: Task[]): TasksState {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  // Ids deletados otimisticamente que o servidor (refresh defasado) ainda pode trazer de volta. Enquanto
  // o id estiver aqui, a tarefa é filtrada do initialTasks pra NÃO "piscar de volta".
  const deletedIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    // A5: merge POR CAMPO. Se a linha do server vier SEM google_event_id/meet_link mas o local já tiver
    // (via realtime), PRESERVA — senão a corrida apagaria o id e o evento ficaria órfão. O realtime depois
    // traz o oficial (merge por id).
    setTasks(prev => {
      const local = new Map(prev.map(t => [t.id, t]))
      return initialTasks
        .filter(t => !deletedIds.current.has(t.id))
        .map(t => {
          const cur = local.get(t.id)
          if (!cur) return t
          return {
            ...t,
            google_event_id: t.google_event_id ?? cur.google_event_id ?? null,
            meet_link: t.meet_link ?? cur.meet_link ?? null,
          }
        })
    })
    if (deletedIds.current.size) {
      const present = new Set(initialTasks.map(t => t.id))
      deletedIds.current.forEach(id => { if (!present.has(id)) deletedIds.current.delete(id) })
    }

  }, [initialTasks])
  // Tempo real: criar/editar/concluir/excluir tarefa reflete ao vivo (merge por id).
  useRealtimeRows<Task>('tasks', setTasks)
  return { tasks, setTasks, deletedIds }
}
