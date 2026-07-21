'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createLeadTaskAction, setLeadTaskDoneAction } from './lead-write-actions'
import { cn } from '@/lib/utils'
import { SituationDrawer } from './SituationDrawer'
import { useToast } from '@/components/ui/toast'

// Tarefa vinculada a um lead (tasks.linked_type='lead' + linked_id). Só os campos
// que esta seção exibe — o CRUD completo continua na página Tarefas.
interface LeadTask {
  id: string
  title: string
  due_date: string | null
  due_time: string | null
  done: boolean
}

// Ordena: pendentes primeiro; dentro de cada grupo, por data e depois hora
// (sem data vai pro fim). Mesma regra usada na criação/conclusão p/ não "pular".
function sortTasks(list: LeadTask[]): LeadTask[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const da = a.due_date ?? '9999-12-31', db = b.due_date ?? '9999-12-31'
    if (da !== db) return da < db ? -1 : 1
    return (a.due_time ?? '99:99').localeCompare(b.due_time ?? '99:99')
  })
}

// dd/mm [hh:mm] compacto (hora só com data).
function fmtWhen(date?: string | null, time?: string | null): string {
  const t = time ? time.slice(0, 5) : ''
  if (!date) return t
  const [, m, d] = date.split('-')
  return t ? `${d}/${m} ${t}` : `${d}/${m}`
}

// Seção "Tarefas" do lead — caixinha contida (mesmo padrão do "Mover para").
// Reutilizada no card estreito do funil (compact) e no painel de detalhe (LeadDiary).
// userId segue no tipo (compat dos callers) mas NÃO é usado: as escritas vão por server action, que resolve
// o usuário/equipe no contexto do servidor (PERMISSIONS-003). A leitura (load) continua client-side (RLS).
export function LeadTasks({ leadId, leadName, compact = true }: {
  leadId: string
  leadName: string
  userId: string
  compact?: boolean
}) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<LeadTask[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSituation, setShowSituation] = useState(false)
  const { toast } = useToast()

  const txt = compact ? 'text-[10px]' : 'text-xs'
  const mono = compact ? 'text-[10px]' : 'text-[10px]'

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, due_date, due_time, done')
      .eq('linked_type', 'lead')
      .eq('linked_id', leadId)
    setTasks(sortTasks(data ?? []))
    setLoading(false)
  }, [supabase, leadId])

  useEffect(() => { load() }, [load])

  const toggleDone = async (t: LeadTask) => {
    const next = !t.done
    setTasks(prev => sortTasks(prev.map(x => x.id === t.id ? { ...x, done: next } : x)))
    const res = await setLeadTaskDoneAction(t.id, next)
    if (!res.ok) {
      setTasks(prev => sortTasks(prev.map(x => x.id === t.id ? { ...x, done: t.done } : x)))
      toast({ type: 'error', message: res.error || 'Não foi possível atualizar a tarefa.' })
    } else if (next) {
      setShowSituation(true)
    }
  }

  const addTask = async () => {
    const title = newTitle.trim()
    if (!title || saving) return
    setSaving(true)
    const res = await createLeadTaskAction({ leadId, leadName, title })
    setSaving(false)
    if (res.ok) {
      setTasks(prev => sortTasks([...prev, res.task as unknown as LeadTask]))
      setNewTitle('')
      setAdding(false)
    } else toast({ type: 'error', message: res.error || 'Não foi possível criar a tarefa.' })
  }

  return (
    <div className="rounded-lg border border-bento-border bg-bento-bg p-2">
      <div className="flex items-center justify-between mb-1.5">
        <p className={cn('font-tech text-bento-muted', txt)}>
          Tarefas{tasks.length > 0 && ` (${tasks.length})`}
        </p>
        <button
          type="button"
          onClick={() => setAdding(a => !a)}
          className={cn('font-tech text-lime-fg hover:text-lime flex items-center gap-0.5 transition-colors', txt)}
        >
          <Plus className="w-3 h-3" /> Nova
        </button>
      </div>

      {adding && (
        <div className="mb-1.5 flex gap-1">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addTask()
              if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
            }}
            placeholder="Título da tarefa"
            autoFocus
            className={cn('flex-1 min-w-0 bg-bento-panel border border-bento-border rounded-md px-1.5 py-1 font-tech text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime', txt)}
          />
          <button
            type="button"
            onClick={addTask}
            disabled={saving || !newTitle.trim()}
            className={cn('px-2 rounded-md border border-lime/40 bg-lime/15 text-lime-fg font-tech disabled:opacity-50', txt)}
          >
            OK
          </button>
        </div>
      )}

      {loading ? (
        <p className={cn('font-tech text-bento-muted/60', txt)}>Carregando…</p>
      ) : tasks.length === 0 ? (
        <p className={cn('font-tech text-bento-muted/60', txt)}>Nenhuma tarefa</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map(t => {
            const when = fmtWhen(t.due_date, t.due_time)
            return (
              <li key={t.id} className="flex items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleDone(t)}
                  aria-label={t.done ? 'Marcar como pendente' : 'Marcar como concluída'}
                  className={cn('mt-px w-3.5 h-3.5 rounded border flex items-center justify-center flex-none transition-colors',
                    t.done ? 'bg-lime/20 border-lime/50 text-lime-fg' : 'border-bento-border hover:border-lime')}
                >
                  {t.done && <Check className="w-2.5 h-2.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    title={t.title}
                    className={cn('font-tech leading-tight truncate', txt, t.done ? 'text-bento-muted line-through' : 'text-bento-text')}
                  >
                    {t.title}
                  </p>
                  {when && (
                    <p className={cn('font-mono flex items-center gap-0.5 tabular-nums', mono, t.done ? 'text-bento-muted/60' : 'text-bento-dim')}>
                      <Clock className="w-2.5 h-2.5 flex-none" /> {when}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showSituation && (
        <SituationDrawer
          lead={{ id: leadId, name: leadName }}
          onClose={() => setShowSituation(false)}
          onSkip={() => setShowSituation(false)}
          onSaved={() => setShowSituation(false)}
        />
      )}
    </div>
  )
}
