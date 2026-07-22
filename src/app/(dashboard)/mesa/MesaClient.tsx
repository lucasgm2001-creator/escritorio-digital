'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronRight, CircleDot, Clock3,
  ExternalLink, Mail, MessageCircle, Phone, Plus, RefreshCw, UserRound, Video,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ymd } from '@/lib/date'
import { waNumber } from '@/lib/phone'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows'
import { useToast } from '@/components/ui/toast'
import { updateTaskAction } from '../tarefas/task-write-actions'
import { useTasksState } from '../tarefas/useTasksState'
import { TaskModal, type TaskPrefill } from '../tarefas/TaskModal'
import type { LinkOption, Task } from '../tarefas/types'
import { SituationDrawer } from '../comercial/SituationDrawer'
import { ALL_COLUMNS, type LeadStatus } from '../comercial/types'
import { TEMPERATURE_LABEL } from '@/lib/commercial/situation'

export interface MesaLead {
  id: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  status: LeadStatus
  score: number
  assigned_name?: string | null
  prioridade?: string | null
  next_contact?: string | null
  last_contact_at?: string | null
  stage_changed_at?: string | null
  created_at: string
  current_situation?: string | null
  last_action?: string | null
  next_action?: string | null
  temperature?: string | null
  followup_state?: string | null
  situation_updated_at?: string | null
}

type Filter = 'hoje' | 'reunioes' | 'aguardando' | 'proximas' | 'atencao' | 'concluidas'
type Interaction = { id: string; type: string; note: string | null; created_by_name: string | null; created_at: string }

const TERMINAL = new Set<LeadStatus>(['fechado', 'perdido', 'negocio_futuro', 'lixeira'])
const HOT = new Set(['muito_quente', 'quente', 'muito_interessado', 'interessado'])
const COLD = new Set(['esfriando', 'frio', 'pouco_interessado'])
const STATUS_LABEL = new Map(ALL_COLUMNS.map(column => [column.key, column.label]))

function taskSort(a: Task, b: Task): number {
  const priority: Record<string, number> = { urgente: 3, alta: 2, normal: 1 }
  const byPriority = (priority[b.priority] ?? 1) - (priority[a.priority] ?? 1)
  if (byPriority) return byPriority
  return `${a.due_date ?? '9999'} ${a.due_time ?? '99:99'}`.localeCompare(`${b.due_date ?? '9999'} ${b.due_time ?? '99:99'}`)
}

function dateLabel(date?: string | null, time?: string | null): string {
  if (!date) return 'Sem data'
  const civilDate = date.slice(0, 10)
  const today = ymd(new Date())
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const prefix = civilDate === today ? 'Hoje' : civilDate === ymd(tomorrowDate) ? 'Amanhã' : civilDate.split('-').reverse().slice(0, 2).join('/')
  return `${prefix}${time ? ` · ${time.slice(0, 5)}` : ''}`
}

function daysSince(value?: string | null): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000))
}

function isWaiting(lead: MesaLead): boolean {
  return lead.followup_state === 'aguardando' || lead.next_action === 'aguardar'
}

function needsAttention(lead: MesaLead, today: string): boolean {
  if (TERMINAL.has(lead.status) || isWaiting(lead)) return false
  return lead.followup_state === 'precisa_agir' || lead.followup_state === 'sem_atualizacao' ||
    (!!lead.next_contact && lead.next_contact.slice(0, 10) <= today) ||
    (!lead.next_contact && (!lead.next_action || lead.next_action === 'nenhuma'))
}

export function MesaClient({ initialTasks, initialLeads, linkOptions, currentUser }: {
  initialTasks: Task[]
  initialLeads: MesaLead[]
  linkOptions: LinkOption[]
  currentUser: { id: string; name: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { tasks, setTasks } = useTasksState(initialTasks)
  const [leads, setLeads] = useState(initialLeads)
  useRealtimeRows<MesaLead>('leads', setLeads)
  useEffect(() => setLeads(initialLeads), [initialLeads])

  const [filter, setFilter] = useState<Filter>('hoje')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalKey, setModalKey] = useState(0)
  const [editing, setEditing] = useState<Task | null>(null)
  const [prefill, setPrefill] = useState<TaskPrefill | null>(null)
  const [situation, setSituation] = useState<{ lead: MesaLead; taskId: string | null } | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [interactionsLoading, setInteractionsLoading] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)

  const today = ymd(new Date())
  const pending = useMemo(() => tasks.filter(task => !task.done).sort(taskSort), [tasks])
  const todayTasks = useMemo(() => pending.filter(task => !!task.due_date && task.due_date <= today), [pending, today])
  const meetingTasks = useMemo(() => pending.filter(task => task.is_meeting), [pending])
  const upcomingTasks = useMemo(() => pending.filter(task => !task.due_date || task.due_date > today), [pending, today])
  const doneTasks = useMemo(() => tasks.filter(task => task.done).sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at)).slice(0, 30), [tasks])
  const waitingLeads = useMemo(() => leads.filter(lead => !TERMINAL.has(lead.status) && isWaiting(lead)), [leads])
  const attentionLeads = useMemo(() => leads.filter(lead => needsAttention(lead, today)), [leads, today])

  const selectedTask = selectedTaskId ? tasks.find(task => task.id === selectedTaskId) ?? null : null
  const selectedLead = selectedLeadId ? leads.find(lead => lead.id === selectedLeadId) ?? null : null

  useEffect(() => {
    if (selectedLeadId || selectedTaskId) return
    const first = todayTasks.find(task => task.linked_type === 'lead' && task.linked_id) ?? todayTasks[0] ?? pending[0]
    if (first) {
      setSelectedTaskId(first.id)
      if (first.linked_type === 'lead') setSelectedLeadId(first.linked_id ?? null)
    } else if (attentionLeads[0]) setSelectedLeadId(attentionLeads[0].id)
  }, [attentionLeads, pending, selectedLeadId, selectedTaskId, todayTasks])

  useEffect(() => {
    if (!selectedLeadId) { setInteractions([]); return }
    let active = true
    setInteractionsLoading(true)
    createClient().from('lead_interactions').select('id, type, note, created_by_name, created_at')
      .eq('lead_id', selectedLeadId).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => {
        if (active) setInteractions((data ?? []) as Interaction[])
        if (active) setInteractionsLoading(false)
      }, () => { if (active) setInteractionsLoading(false) })
    return () => { active = false }
  }, [selectedLeadId])

  const filters: { id: Filter; label: string; Icon: LucideIcon; count: number }[] = [
    { id: 'hoje', label: 'Hoje', Icon: CircleDot, count: todayTasks.length },
    { id: 'reunioes', label: 'Reuniões', Icon: Video, count: meetingTasks.length },
    { id: 'aguardando', label: 'Aguardando', Icon: Clock3, count: waitingLeads.length },
    { id: 'proximas', label: 'Próximas', Icon: CalendarDays, count: upcomingTasks.length },
    { id: 'atencao', label: 'Precisam de ação', Icon: AlertTriangle, count: attentionLeads.length },
    { id: 'concluidas', label: 'Concluídas', Icon: CheckCircle2, count: doneTasks.length },
  ]

  const taskRows = filter === 'hoje' ? todayTasks : filter === 'reunioes' ? meetingTasks : filter === 'proximas' ? upcomingTasks : filter === 'concluidas' ? doneTasks : []
  const leadRows = filter === 'aguardando' ? waitingLeads : filter === 'atencao' ? attentionLeads : []

  function selectTask(task: Task) {
    setSelectedTaskId(task.id)
    setSelectedLeadId(task.linked_type === 'lead' ? task.linked_id ?? null : null)
  }

  function selectLead(lead: MesaLead) {
    setSelectedTaskId(null)
    setSelectedLeadId(lead.id)
  }

  function openNew(lead = selectedLead) {
    setEditing(null)
    setPrefill({
      due_date: today,
      link: lead ? { type: 'lead', id: lead.id, name: lead.name, phone: lead.phone, detail: lead.company } : null,
    })
    setModalKey(key => key + 1)
    setModalOpen(true)
  }

  function openEdit(task: Task) {
    setEditing(task); setPrefill(null); setModalKey(key => key + 1); setModalOpen(true)
  }

  function handleSaved(task: Task) {
    setTasks(current => current.some(row => row.id === task.id) ? current.map(row => row.id === task.id ? task : row) : [task, ...current])
    setSelectedTaskId(task.id)
    if (task.linked_type === 'lead') setSelectedLeadId(task.linked_id ?? null)
    setModalOpen(false)
    router.refresh()
  }

  async function toggleTask(task: Task) {
    if (busyTaskId) return
    const done = !task.done
    const completed_at = done ? new Date().toISOString() : null
    setBusyTaskId(task.id)
    setTasks(current => current.map(row => row.id === task.id ? { ...row, done, completed_at } : row))
    const { error } = await updateTaskAction(task.id, { done, completed_at })
    setBusyTaskId(null)
    if (error) {
      setTasks(current => current.map(row => row.id === task.id ? task : row))
      toast({ type: 'error', message: 'Não foi possível atualizar a tarefa.' })
      return
    }
    if (done && task.linked_type === 'lead' && task.linked_id) {
      const lead = leads.find(row => row.id === task.linked_id)
      if (lead) setSituation({ lead, taskId: task.id })
    }
    router.refresh()
  }

  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="min-h-full bg-bento-bg font-body">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-bento-text tracking-tight">{greeting}, {currentUser.name}</h1>
            <p className="text-sm text-bento-muted mt-1">Tudo o que você precisa para conduzir o trabalho comercial de hoje.</p>
          </div>
          <button type="button" onClick={() => openNew()} className="bento-btn inline-flex items-center gap-2 px-4 min-h-[42px] rounded-btn text-sm font-semibold">
            <Plus className="w-4 h-4" /> Nova tarefa
          </button>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5" aria-label="Resumo do dia">
          <SummaryCard label="Para hoje" value={todayTasks.length} hint={todayTasks.some(task => task.due_date && task.due_date < today) ? 'inclui atrasadas' : 'em ordem'} tone="default" />
          <SummaryCard label="Reuniões" value={meetingTasks.filter(task => task.due_date === today).length} hint="hoje" tone="default" />
          <SummaryCard label="Aguardando" value={waitingLeads.length} hint="retorno do lead" tone="muted" />
          <SummaryCard label="Precisam de ação" value={attentionLeads.length} hint="vencida ou ausente" tone={attentionLeads.length ? 'warning' : 'muted'} />
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[184px_minmax(0,1fr)_360px] gap-3 items-start">
          <nav className="bento-fx p-2 xl:sticky xl:top-3" aria-label="Organização da mesa">
            <div className="flex xl:flex-col gap-1 overflow-x-auto scrollbar-none">
              {filters.map(item => (
                <button key={item.id} type="button" onClick={() => setFilter(item.id)}
                  className={cn('flex items-center gap-2.5 min-h-[42px] px-3 rounded-btn text-sm whitespace-nowrap transition-colors shrink-0 xl:w-full',
                    filter === item.id ? 'bg-lime/12 text-lime-fg' : 'text-bento-muted hover:bg-bento-bg hover:text-bento-text')}>
                  <item.Icon className="w-4 h-4 shrink-0" />
                  <span className="xl:flex-1 text-left">{item.label}</span>
                  <span className="font-tech text-[10px] tabular-nums text-current opacity-70">{item.count}</span>
                </button>
              ))}
            </div>
          </nav>

          <section className="bento-fx min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-bento-border">
              <div>
                <h2 className="font-display font-semibold text-bento-text">{filters.find(item => item.id === filter)?.label}</h2>
                <p className="text-xs text-bento-muted mt-0.5">{taskRows.length || leadRows.length} {taskRows.length + leadRows.length === 1 ? 'item' : 'itens'}</p>
              </div>
              <button type="button" onClick={() => router.refresh()} aria-label="Atualizar" className="p-2 text-bento-muted hover:text-bento-text rounded-btn hover:bg-bento-bg">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 sm:p-3 space-y-2">
              {taskRows.map(task => (
                <TaskRow key={task.id} task={task} active={selectedTaskId === task.id} today={today}
                  busy={busyTaskId === task.id} onSelect={() => selectTask(task)} onToggle={() => toggleTask(task)} onEdit={() => openEdit(task)} />
              ))}
              {leadRows.map(lead => (
                <LeadRow key={lead.id} lead={lead} active={selectedLeadId === lead.id} onSelect={() => selectLead(lead)} />
              ))}
              {taskRows.length === 0 && leadRows.length === 0 && <EmptyFilter filter={filter} />}
            </div>
          </section>

          <aside className="bento-fx xl:sticky xl:top-3 min-w-0">
            {selectedLead ? (
              <LeadContext lead={selectedLead} task={selectedTask} interactions={interactions} loading={interactionsLoading}
                onNewTask={() => openNew(selectedLead)} onEditTask={selectedTask ? () => openEdit(selectedTask) : undefined}
                onSituation={() => setSituation({ lead: selectedLead, taskId: null })} />
            ) : selectedTask ? (
              <GenericTaskContext task={selectedTask} onEdit={() => openEdit(selectedTask)} />
            ) : (
              <div className="p-8 text-center">
                <UserRound className="w-8 h-8 text-bento-muted mx-auto mb-3" />
                <p className="text-sm font-medium text-bento-text">Selecione um item</p>
                <p className="text-xs text-bento-muted mt-1">O contexto necessário para trabalhar aparecerá aqui.</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {modalOpen && (
        <TaskModal key={modalKey} onClose={() => setModalOpen(false)} onSaved={handleSaved} currentUser={currentUser}
          linkOptions={linkOptions} task={editing} prefill={prefill} aiFilled={false} />
      )}

      {situation && (
        <SituationDrawer lead={{ id: situation.lead.id, name: situation.lead.name }} sourceTaskId={situation.taskId}
          onClose={() => setSituation(null)} onSkip={() => setSituation(null)}
          onSaved={({ nextTask, patch }) => {
            setLeads(current => current.map(lead => lead.id === situation.lead.id ? { ...lead, ...patch } : lead))
            if (nextTask) {
              const savedTask = nextTask as unknown as Task
              setTasks(current => current.some(task => task.id === savedTask.id)
                ? current.map(task => task.id === savedTask.id ? { ...task, ...savedTask } : task)
                : [savedTask, ...current])
              fetch('/api/tasks/calendar-sync', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: savedTask.id }), keepalive: true,
              }).catch(() => toast({ type: 'error', message: 'A ação foi salva, mas o Google Agenda não sincronizou.' }))
            }
            toast({ type: 'success', message: nextTask ? 'Contato registrado e próxima ação organizada.' : 'Contato registrado.' })
            setSituation(null); router.refresh()
          }} />
      )}
    </div>
  )
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: 'default' | 'warning' | 'muted' }) {
  return (
    <div className="bento-fx px-4 py-3 min-w-0">
      <p className="font-tech text-[10px] uppercase tracking-label text-bento-muted truncate">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <strong className={cn('font-display text-2xl tabular-nums', tone === 'warning' ? 'text-amber-400' : tone === 'muted' ? 'text-bento-dim' : 'text-bento-text')}>{value}</strong>
        <span className="text-[11px] text-bento-muted truncate">{hint}</span>
      </div>
    </div>
  )
}

function TaskRow({ task, active, today, busy, onSelect, onToggle, onEdit }: {
  task: Task; active: boolean; today: string; busy: boolean; onSelect: () => void; onToggle: () => void; onEdit: () => void
}) {
  const overdue = !task.done && !!task.due_date && task.due_date < today
  return (
    <div className={cn('group flex items-start gap-3 rounded-bento border p-3 transition-colors',
        active ? 'border-lime/50 bg-lime/[0.07]' : 'border-bento-border bg-bento-bg/35 hover:border-bento-dim/60')}>
      <button type="button" disabled={busy} onClick={onToggle} aria-label={task.done ? 'Reabrir tarefa' : 'Concluir tarefa'}
        className={cn('mt-0.5 w-5 h-5 rounded-md border grid place-items-center shrink-0 transition-colors', task.done ? 'bg-lime border-lime text-lime-ink' : 'border-bento-border hover:border-lime')}>
        {task.done && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>
      <button type="button" onClick={onSelect} onDoubleClick={onEdit} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-lime/50 rounded-sm">
        <div className="flex items-start justify-between gap-3">
          <p className={cn('text-sm leading-snug', task.done ? 'line-through text-bento-muted' : 'text-bento-text')}>{task.title}</p>
          <span className={cn('font-tech text-[10px] whitespace-nowrap', overdue ? 'text-red-400' : 'text-bento-muted')}>{dateLabel(task.due_date, task.due_time)}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 min-w-0">
          {task.is_meeting ? <Video className="w-3.5 h-3.5 text-purple-400" /> : task.add_call ? <Phone className="w-3.5 h-3.5 text-blue-400" /> : <CircleDot className="w-3.5 h-3.5 text-bento-muted" />}
          <span className="text-[11px] text-bento-muted truncate">{task.linked_name ?? 'Tarefa geral'}</span>
          {task.priority !== 'normal' && <span className={cn('text-[9px] uppercase font-semibold', task.priority === 'urgente' ? 'text-red-400' : 'text-amber-400')}>{task.priority}</span>}
          <ChevronRight className="w-3.5 h-3.5 text-bento-muted ml-auto opacity-0 group-hover:opacity-100" />
        </div>
      </button>
    </div>
  )
}

function LeadRow({ lead, active, onSelect }: { lead: MesaLead; active: boolean; onSelect: () => void }) {
  const temperature = lead.temperature ? TEMPERATURE_LABEL[lead.temperature as keyof typeof TEMPERATURE_LABEL] ?? lead.temperature : 'Sem avaliação'
  return (
    <button type="button" onClick={onSelect} className={cn('w-full flex items-center gap-3 rounded-bento border p-3 text-left transition-colors',
      active ? 'border-lime/50 bg-lime/[0.07]' : 'border-bento-border bg-bento-bg/35 hover:border-bento-dim/60')}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', HOT.has(lead.temperature ?? '') ? 'bg-lime' : COLD.has(lead.temperature ?? '') ? 'bg-blue-400' : 'bg-amber-400')} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-bento-text truncate">{lead.name}</span>
        <span className="block text-[11px] text-bento-muted truncate">{lead.current_situation || STATUS_LABEL.get(lead.status) || lead.status}</span>
      </span>
      <span className="text-[10px] text-bento-muted shrink-0">{temperature}</span>
      <ChevronRight className="w-4 h-4 text-bento-muted" />
    </button>
  )
}

function LeadContext({ lead, task, interactions, loading, onNewTask, onEditTask, onSituation }: {
  lead: MesaLead; task: Task | null; interactions: Interaction[]; loading: boolean
  onNewTask: () => void; onEditTask?: () => void; onSituation: () => void
}) {
  const stopped = daysSince(lead.last_contact_at ?? lead.stage_changed_at ?? lead.created_at)
  const phone = lead.phone?.trim() ?? ''
  const whatsApp = phone ? waNumber(phone) : ''
  const temperature = lead.temperature ? TEMPERATURE_LABEL[lead.temperature as keyof typeof TEMPERATURE_LABEL] ?? lead.temperature : 'Não avaliado'
  return (
    <div>
      <div className="p-4 border-b border-bento-border">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-lime/15 border border-lime/30 grid place-items-center font-display font-bold text-lime-fg shrink-0">{lead.name.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-semibold text-bento-text truncate">{lead.name}</h2>
            <p className="text-xs text-bento-muted truncate">{lead.company || 'Sem empresa informada'}</p>
          </div>
          <Link href={`/comercial?lead=${encodeURIComponent(lead.id)}`} aria-label="Abrir lead completo" className="p-2 rounded-btn text-bento-muted hover:text-lime-fg hover:bg-bento-bg">
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge>{STATUS_LABEL.get(lead.status) ?? lead.status}</Badge>
          <Badge tone={HOT.has(lead.temperature ?? '') ? 'hot' : COLD.has(lead.temperature ?? '') ? 'cold' : 'neutral'}>{temperature}</Badge>
          {stopped !== null && <Badge tone={stopped >= 5 ? 'warning' : 'neutral'}>{stopped}d sem contato</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 p-3 border-b border-bento-border">
        <ContactButton href={phone ? `tel:${phone}` : undefined} Icon={Phone} label="Ligar" />
        <ContactButton href={whatsApp ? `https://wa.me/${whatsApp}` : undefined} Icon={MessageCircle} label="WhatsApp" external />
        <ContactButton href={lead.email ? `mailto:${lead.email}` : undefined} Icon={Mail} label="E-mail" />
      </div>

      <div className="p-4 space-y-4">
        <ContextBlock label="Situação atual" value={lead.current_situation || 'Nenhuma situação registrada.'} />
        <div className="grid grid-cols-2 gap-3">
          <ContextBlock label="Responsável" value={lead.assigned_name || '—'} />
          <ContextBlock label="Próxima ação" value={lead.next_action && lead.next_action !== 'nenhuma' ? lead.next_action.replaceAll('_', ' ') : 'Não definida'} />
          <ContextBlock label="Último contato" value={lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleDateString('pt-BR') : 'Ainda não registrado'} />
          <ContextBlock label="Próximo contato" value={lead.next_contact ? dateLabel(lead.next_contact) : 'Sem data'} />
        </div>

        {task && (
          <div className="rounded-bento border border-bento-border bg-bento-bg/50 p-3">
            <p className="font-tech text-[10px] uppercase tracking-label text-bento-muted">Ação selecionada</p>
            <p className="text-sm text-bento-text mt-1">{task.title}</p>
            {task.notes && <p className="text-xs text-bento-muted mt-1.5 line-clamp-3">{task.notes}</p>}
            {onEditTask && <button type="button" onClick={onEditTask} className="text-xs text-lime-fg mt-2 hover:underline">Editar tarefa</button>}
          </div>
        )}

        <div>
          <p className="font-tech text-[10px] uppercase tracking-label text-bento-muted mb-2">Histórico recente</p>
          {loading ? <p className="text-xs text-bento-muted">Carregando histórico…</p> : interactions.length ? (
            <div className="space-y-2">
              {interactions.map(item => (
                <div key={item.id} className="flex gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-bento-dim mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-bento-dim truncate">{item.note || item.type.replaceAll('_', ' ')}</p>
                    <p className="font-tech text-[9px] text-bento-muted mt-0.5">{new Date(item.created_at).toLocaleDateString('pt-BR')} · {item.created_by_name || 'Sistema'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-bento-muted">Nenhum contato registrado.</p>}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={onSituation} className="min-h-[40px] rounded-btn border border-bento-border text-xs font-medium text-bento-text hover:border-lime transition-colors">Registrar contato</button>
          <button type="button" onClick={onNewTask} className="bento-btn min-h-[40px] rounded-btn text-xs font-semibold">Próxima ação</button>
        </div>
      </div>
    </div>
  )
}

function GenericTaskContext({ task, onEdit }: { task: Task; onEdit: () => void }) {
  return (
    <div className="p-5">
      <p className="font-tech text-[10px] uppercase tracking-label text-bento-muted">Tarefa geral</p>
      <h2 className="font-display font-semibold text-bento-text mt-2">{task.title}</h2>
      <p className="text-xs text-bento-muted mt-2">{dateLabel(task.due_date, task.due_time)}</p>
      {task.notes && <p className="text-sm text-bento-dim mt-4 whitespace-pre-wrap">{task.notes}</p>}
      <button type="button" onClick={onEdit} className="bento-btn w-full min-h-[40px] rounded-btn text-sm font-semibold mt-5">Editar tarefa</button>
    </div>
  )
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'hot' | 'cold' | 'warning' }) {
  return <span className={cn('rounded-full border px-2 py-0.5 font-tech text-[9px] uppercase tracking-wide',
    tone === 'hot' ? 'border-lime/30 bg-lime/10 text-lime-fg' : tone === 'cold' ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : tone === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-bento-border text-bento-dim')}>{children}</span>
}

function ContactButton({ href, Icon, label, external }: { href?: string; Icon: LucideIcon; label: string; external?: boolean }) {
  const cls = cn('min-h-[42px] rounded-btn border flex flex-col items-center justify-center gap-1 text-[10px] transition-colors', href ? 'border-bento-border text-bento-dim hover:border-lime hover:text-lime-fg' : 'border-bento-border/50 text-bento-muted/40 cursor-not-allowed')
  return href ? <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={cls}><Icon className="w-4 h-4" />{label}</a>
    : <span className={cls}><Icon className="w-4 h-4" />{label}</span>
}

function ContextBlock({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="font-tech text-[9px] uppercase tracking-wide text-bento-muted">{label}</p><p className="text-xs text-bento-dim mt-1 capitalize break-words">{value}</p></div>
}

function EmptyFilter({ filter }: { filter: Filter }) {
  const messages: Record<Filter, string> = {
    hoje: 'Nenhuma ação pendente para hoje.', reunioes: 'Nenhuma reunião pendente.', aguardando: 'Nenhum lead aguardando retorno.',
    proximas: 'Nenhuma próxima ação organizada.', atencao: 'Nenhuma ação vencida ou sem data.', concluidas: 'Nenhuma tarefa concluída recentemente.',
  }
  return <div className="py-16 text-center"><CheckCircle2 className="w-8 h-8 text-bento-muted mx-auto mb-3" /><p className="text-sm text-bento-dim">{messages[filter]}</p></div>
}
