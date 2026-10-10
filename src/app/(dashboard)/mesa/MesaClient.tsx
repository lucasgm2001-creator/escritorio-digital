'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronRight, CircleDot, Clock3, Star,
  ExternalLink, FileText, Mail, MessageCircle, Phone, Plus, RefreshCw, Search, UserRound, Video, X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ymd } from '@/lib/date'
import { waNumber } from '@/lib/phone'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows'
import { useToast } from '@/components/ui/toast'
import { updateTaskAction } from '../tarefas/task-write-actions'
import { toggleLeadFocusAction, closeStaleLeadTasksAction } from './focus-actions'
import { useTasksState } from '../tarefas/useTasksState'
import { TaskModal, type TaskPrefill } from '../tarefas/TaskModal'
import type { LinkOption, Task } from '../tarefas/types'
import { SituationDrawer } from '../comercial/SituationDrawer'
import { ALL_COLUMNS, type LeadStatus } from '../comercial/types'
import { NEXT_ACTION_LABEL, TEMPERATURE_LABEL, isNextAction } from '@/lib/commercial/situation'
import { inferTaskKind } from '@/lib/tasks/task-kind'
import { ObservationsBox } from '@/components/observations/ObservationsBox'
import { RelatorioPanel } from './RelatorioPanel'

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
  received_at?: string | null
  current_situation?: string | null
  last_action?: string | null
  next_action?: string | null
  temperature?: string | null
  followup_state?: string | null
  situation_updated_at?: string | null
}

type Filter = 'hoje' | 'atrasado' | 'acompanhando' | 'reunioes' | 'leads' | 'aguardando' | 'proximas' | 'atencao' | 'concluidas'
type Interaction = { id: string; type: string; note: string | null; created_by_name: string | null; created_at: string }

const TERMINAL = new Set<LeadStatus>(['fechado', 'perdido', 'negocio_futuro', 'lixeira'])
const HOT = new Set(['muito_quente', 'quente', 'muito_interessado', 'interessado'])
const COLD = new Set(['esfriando', 'frio', 'pouco_interessado'])
const STATUS_LABEL = new Map(ALL_COLUMNS.map(column => [column.key, column.label]))

// Busca sem acento e sem caixa: a base tem "Gouvêa", "André", "Mizael". Exigir o acento certo faria a
// busca falhar justamente nos nomes que mais precisam dela.
const normalizar = (v: string): string =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

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

export function MesaClient({ initialTasks, initialLeads, initialFocus, linkOptions, currentUser }: {
  initialTasks: Task[]
  initialLeads: MesaLead[]
  initialFocus: string[]
  linkOptions: LinkOption[]
  currentUser: { id: string; name: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { tasks, setTasks } = useTasksState(initialTasks)
  const [leads, setLeads] = useState(initialLeads)
  useRealtimeRows<MesaLead>('leads', setLeads)
  useEffect(() => setLeads(initialLeads), [initialLeads])

  // Alternador Tarefas/Relatório — só client-side (sem navegação de rota). Default = Tarefas.
  const [panel, setPanel] = useState<'tarefas' | 'relatorio'>('tarefas')
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
  const [busca, setBusca] = useState('')
  const [focus, setFocus] = useState<Set<string>>(() => new Set(initialFocus))
  useEffect(() => setFocus(new Set(initialFocus)), [initialFocus])

  const today = ymd(new Date())
  const pendingRaw = useMemo(() => tasks.filter(task => !task.done).sort(taskSort), [tasks])

  // UMA TAREFA POR LEAD (MESA-DEDUP-001). O mesmo lead acumulava 2 ou 3 tarefas abertas: uma antiga que
  // ficou para trás e a nova criada no contato seguinte ("Ligar para Cesar [17/09]" e "Ligar novamente:
  // Cesar [12/10]"). Eram 137 tarefas para 119 leads — 18 linhas de resíduo competindo pela mesma pessoa.
  //
  // Vale a MAIS RECENTE (created_at), porque é a última decisão tomada sobre aquele lead. As anteriores
  // não somem caladas: a linha mostra "+N anteriores" e dá para encerrá-las de uma vez.
  const supersededByTask = useMemo(() => {
    const porLead = new Map<string, Task[]>()
    for (const task of pendingRaw) {
      if (task.linked_type !== 'lead' || !task.linked_id) continue
      const lista = porLead.get(task.linked_id) ?? []
      lista.push(task)
      porLead.set(task.linked_id, lista)
    }
    const vencedora = new Map<string, Task>()
    const antigas = new Map<string, Task[]>()
    for (const [leadId, lista] of porLead) {
      const ordenada = [...lista].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      vencedora.set(leadId, ordenada[0])
      antigas.set(ordenada[0].id, ordenada.slice(1))
    }
    return { vencedora, antigas }
  }, [pendingRaw])

  // Lista de trabalho já deduplicada: tarefa sem lead passa direto; com lead, só a vencedora.
  const pending = useMemo(() => pendingRaw.filter(task =>
    task.linked_type !== 'lead' || !task.linked_id ||
    supersededByTask.vencedora.get(task.linked_id)?.id === task.id), [pendingRaw, supersededByTask])

  // HOJE = só o que é de hoje (MESA-HOJE-001). Antes era `due_date <= today`, então as 131 atrasadas
  // entravam aqui e a aba abria com 133 itens — uma pilha, não uma lista de trabalho. Atrasado ganhou
  // aba própria para continuar visível sem afogar o dia.
  const todayTasks = useMemo(() => pending.filter(task => task.due_date === today), [pending, today])
  const overdueTasks = useMemo(() => pending.filter(task => !!task.due_date && task.due_date < today), [pending, today])
  const meetingTasks = useMemo(() => pending.filter(task => inferTaskKind(task.title, task.kind) === 'reuniao'), [pending])
  const upcomingTasks = useMemo(() => pending.filter(task => !task.due_date || task.due_date > today), [pending, today])
  const doneTasks = useMemo(() => tasks.filter(task => task.done).sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at)).slice(0, 30), [tasks])
  const waitingLeads = useMemo(() => leads.filter(lead => !TERMINAL.has(lead.status) && isWaiting(lead)), [leads])
  const attentionLeads = useMemo(() => leads.filter(lead => needsAttention(lead, today)), [leads, today])
  // TODOS os leads em jogo, para percorrer sem precisar digitar nada. Fora os terminais (fechado, perdido,
  // negócio futuro): numa lista de navegação eles são ruído — quem procura um fechado usa a busca, que os
  // inclui. Ordem: quem precisa de ação primeiro, depois por score, que é a ordem em que vale ligar.
  // Leads que CHEGARAM HOJE. received_at é a data de entrada (o webhook do Magnetic a preenche; está
  // presente em 100% da base), com created_at de reserva para qualquer lead criado à mão sem ela.
  const chegouHoje = (lead: MesaLead): boolean =>
    (lead.received_at ?? lead.created_at ?? '').slice(0, 10) === today
  const newLeadsToday = useMemo(() => leads.filter(lead => !TERMINAL.has(lead.status) && chegouHoje(lead)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, today])

  // Radar pessoal: a ordem segue a urgência real — quem precisa de ação primeiro, depois quem está parado
  // há mais tempo. É a aba para onde o lead vai DEPOIS do contato, para não se perder entre os atrasados.
  const focusLeads = useMemo(() => leads
    .filter(lead => focus.has(lead.id))
    .sort((a, b) =>
      (needsAttention(b, today) ? 1 : 0) - (needsAttention(a, today) ? 1 : 0) ||
      (daysSince(b.last_contact_at) ?? 0) - (daysSince(a.last_contact_at) ?? 0)),
    [leads, focus, today])

  const allLeads = useMemo(() => {
    const vivos = leads.filter(lead => !TERMINAL.has(lead.status))
    return [...vivos].sort((a, b) =>
      (needsAttention(b, today) ? 1 : 0) - (needsAttention(a, today) ? 1 : 0) || b.score - a.score)
  }, [leads, today])

  const selectedTask = selectedTaskId ? tasks.find(task => task.id === selectedTaskId) ?? null : null
  const selectedLead = selectedLeadId ? leads.find(lead => lead.id === selectedLeadId) ?? null : null

  // A Mesa abre SEM nada selecionado (MESA-BUSCA-001). Antes um efeito escolhia a primeira tarefa de hoje
  // ligada a lead — ou o primeiro que precisava de atenção — e o painel da direita já abria no contexto de
  // um lead que o usuário nunca pediu. Agora o painel começa no estado vazio e quem escolhe é quem usa.
  // O lead certo se acha pela BUSCA ou pelas listas, não por um palpite da tela.

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
    { id: 'hoje', label: 'Hoje', Icon: CircleDot, count: todayTasks.length + newLeadsToday.length },
    { id: 'atrasado', label: 'Atrasado', Icon: AlertTriangle, count: overdueTasks.length },
    { id: 'acompanhando', label: 'Acompanhando', Icon: Star, count: focusLeads.length },
    { id: 'reunioes', label: 'Reuniões', Icon: Video, count: meetingTasks.length },
    { id: 'leads', label: 'Leads', Icon: UserRound, count: allLeads.length },
    { id: 'aguardando', label: 'Aguardando', Icon: Clock3, count: waitingLeads.length },
    { id: 'proximas', label: 'Próximas', Icon: CalendarDays, count: upcomingTasks.length },
    { id: 'atencao', label: 'Precisam de ação', Icon: AlertTriangle, count: attentionLeads.length },
    { id: 'concluidas', label: 'Concluídas', Icon: CheckCircle2, count: doneTasks.length },
  ]

  // Resultado da busca: varre TODOS os leads carregados, não só os do filtro ativo — procurar um lead e
  // não achar porque ele estava fora da aba selecionada seria pior que não ter busca. Terminal (fechado,
  // perdido, negócio futuro) entra também: achar um fechado para consultar é uso legítimo, e a linha
  // mostra o estágio, então não há confusão sobre onde ele está.
  const termo = normalizar(busca)
  const resultados = useMemo(() => {
    if (!termo) return []
    return leads
      .filter(lead => normalizar(lead.name).includes(termo) || normalizar(lead.company ?? '').includes(termo))
      .sort((a, b) => {
        // Quem começa com o termo digitado vem primeiro: buscando "ma", Mael antes de "Firma Mael".
        const aStart = normalizar(a.name).startsWith(termo) ? 0 : 1
        const bStart = normalizar(b.name).startsWith(termo) ? 0 : 1
        return aStart - bStart || a.name.localeCompare(b.name)
      })
      .slice(0, 40)
  }, [leads, termo])
  const buscando = termo.length > 0

  const taskRows = filter === 'hoje' ? todayTasks : filter === 'atrasado' ? overdueTasks
    : filter === 'reunioes' ? meetingTasks : filter === 'proximas' ? upcomingTasks : filter === 'concluidas' ? doneTasks : []
  // "Hoje" mostra as duas coisas: o que vence hoje E quem chegou hoje — leads novos são trabalho do dia
  // tanto quanto uma tarefa agendada, e antes só apareciam se alguém criasse tarefa para eles.
  const leadRows = filter === 'hoje' ? newLeadsToday : filter === 'acompanhando' ? focusLeads
    : filter === 'leads' ? allLeads : filter === 'aguardando' ? waitingLeads : filter === 'atencao' ? attentionLeads : []

  function selectTask(task: Task) {
    setSelectedTaskId(task.id)
    setSelectedLeadId(task.linked_type === 'lead' ? task.linked_id ?? null : null)
  }

  // Radar: otimista, com rollback. Marcar um lead no meio de uma ligação não pode esperar round-trip.
  async function toggleFocus(leadId: string) {
    const ligar = !focus.has(leadId)
    setFocus(atual => { const proximo = new Set(atual); if (ligar) proximo.add(leadId); else proximo.delete(leadId); return proximo })
    const r = await toggleLeadFocusAction(leadId, ligar)
    if (!r.ok) {
      setFocus(atual => { const proximo = new Set(atual); if (ligar) proximo.delete(leadId); else proximo.add(leadId); return proximo })
      toast({ type: 'error', message: r.error })
    }
  }

  // Encerra as tarefas antigas do lead, mantendo a atual. É a saída para o resíduo que a dedupe revela.
  async function resolverDuplicadas(task: Task) {
    if (!task.linked_id) return
    const antigas = supersededByTask.antigas.get(task.id) ?? []
    if (antigas.length === 0) return
    setBusyTaskId(task.id)
    const r = await closeStaleLeadTasksAction(task.linked_id, task.id)
    setBusyTaskId(null)
    if (!r.ok) { toast({ type: 'error', message: r.error ?? 'Não foi possível fechar as duplicadas.' }); return }
    const ids = new Set(antigas.map(t => t.id))
    setTasks(atual => atual.map(t => ids.has(t.id) ? { ...t, done: true } : t))
    toast({ type: 'success', message: `${r.fechadas} tarefa(s) antiga(s) encerrada(s).` })
  }

  function selectLead(lead: MesaLead) {
    setSelectedTaskId(null)
    setSelectedLeadId(lead.id)
  }

  // Nova tarefa nasce SEM vínculo por padrão (MESA-NOVATAREFA-001). O painel de contexto auto-seleciona um
  // lead ao abrir a Mesa (primeira tarefa de hoje ligada a lead, senão o primeiro que precisa de atenção) e
  // esse padrão era `lead = selectedLead`: o botão "Nova tarefa" da barra herdava um lead que o usuário nunca
  // escolheu. Quem QUER o vínculo passa o lead explicitamente — é o caso do "Próxima ação", dentro do painel
  // do lead, onde a tarefa é por definição daquele lead.
  function openNew(lead: MesaLead | null = null) {
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
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1">
              <button type="button" onClick={() => setPanel('tarefas')}
                className={cn('px-3.5 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                  panel === 'tarefas' ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
                Tarefas
              </button>
              <button type="button" onClick={() => setPanel('relatorio')}
                className={cn('px-3.5 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                  panel === 'relatorio' ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
                Relatório
              </button>
            </div>
            {panel === 'tarefas' && (
              <button type="button" onClick={() => openNew()} className="bento-btn inline-flex items-center gap-2 px-4 min-h-[42px] rounded-btn text-sm font-semibold">
                <Plus className="w-4 h-4" /> Nova tarefa
              </button>
            )}
          </div>
        </header>

        {panel === 'relatorio' ? (
          <RelatorioPanel />
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5" aria-label="Resumo do dia">
              {/* O topo passou a separar HOJE de ATRASADO. Antes "Para hoje" somava as atrasadas e marcava
                  133 — um número que assusta e não diz o que fazer. Agora o dia é o dia, e o passivo tem
                  o próprio lugar. "Acompanhando" entra no lugar de "Precisam de ação": é a lista curta
                  que a pessoa mantém, não a contagem de 200 que ninguém consegue atacar. */}
              <SummaryCard label="Para hoje" value={todayTasks.length + newLeadsToday.length}
                hint={newLeadsToday.length ? `${newLeadsToday.length} lead(s) novo(s)` : 'tarefas de hoje'} tone="default" />
              <SummaryCard label="Atrasado" value={overdueTasks.length} hint="de dias anteriores"
                tone={overdueTasks.length ? 'warning' : 'muted'} />
              <SummaryCard label="Reuniões" value={meetingTasks.filter(task => task.due_date === today).length} hint="hoje" tone="default" />
              <SummaryCard label="Acompanhando" value={focusLeads.length} hint="no seu radar" tone="muted" />
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
                  <div className="min-w-0">
                    <h2 className="font-display font-semibold text-bento-text truncate">
                      {buscando ? 'Busca de leads' : filters.find(item => item.id === filter)?.label}
                    </h2>
                    <p className="text-xs text-bento-muted mt-0.5">
                      {buscando
                        ? `${resultados.length} ${resultados.length === 1 ? 'lead encontrado' : 'leads encontrados'}`
                        : `${taskRows.length || leadRows.length} ${taskRows.length + leadRows.length === 1 ? 'item' : 'itens'}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => router.refresh()} aria-label="Atualizar" className="p-2 text-bento-muted hover:text-bento-text rounded-btn hover:bg-bento-bg">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* BUSCA DE LEAD (MESA-BUSCA-001). Procura em TODOS os leads carregados, por nome ou empresa,
                    sem acento e sem caixa. Enquanto há termo digitado, a lista mostra o resultado em vez do
                    filtro — o filtro continua escolhido e volta sozinho ao limpar a busca. */}
                <div className="border-b border-bento-border px-3 py-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bento-muted" />
                    <input
                      value={busca}
                      onChange={event => setBusca(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Escape') setBusca('')
                        // Enter abre o primeiro resultado: digitar o nome e apertar Enter é o caminho mais
                        // curto entre "quero esse lead" e ter o contexto dele na tela.
                        if (event.key === 'Enter' && resultados[0]) selectLead(resultados[0])
                      }}
                      placeholder="Buscar lead por nome ou empresa…"
                      aria-label="Buscar lead por nome ou empresa"
                      className="w-full rounded-btn border border-bento-border bg-bento-bg py-2.5 pl-9 pr-9 text-sm text-bento-text placeholder:text-bento-muted focus:border-lime focus:outline-none"
                    />
                    {busca && (
                      <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-bento-muted hover:text-bento-text">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-2 sm:p-3 space-y-2">
                  {buscando ? (
                    resultados.length === 0 ? (
                      <p className="px-2 py-10 text-center text-sm text-bento-muted">
                        Nenhum lead com “{busca.trim()}” no nome ou na empresa.
                      </p>
                    ) : resultados.map(lead => (
                      <LeadRow key={lead.id} lead={lead} active={selectedLeadId === lead.id}
                        mostrarEmpresa noRadar={focus.has(lead.id)} onToggleFocus={() => toggleFocus(lead.id)}
                        onSelect={() => selectLead(lead)} />
                    ))
                  ) : (
                    <>
                      {taskRows.map(task => (
                        <TaskRowComDuplicadas key={task.id} task={task} active={selectedTaskId === task.id} today={today}
                          busy={busyTaskId === task.id}
                          antigas={(supersededByTask.antigas.get(task.id) ?? []).length}
                          onResolver={() => resolverDuplicadas(task)}
                          onSelect={() => selectTask(task)} onToggle={() => toggleTask(task)} onEdit={() => openEdit(task)} />
                      ))}
                      {leadRows.map(lead => (
                        <LeadRow key={lead.id} lead={lead} active={selectedLeadId === lead.id}
                          mostrarEmpresa={filter === 'leads' || filter === 'acompanhando' || filter === 'hoje'}
                          noRadar={focus.has(lead.id)} onToggleFocus={() => toggleFocus(lead.id)}
                          onSelect={() => selectLead(lead)} />
                      ))}
                      {taskRows.length === 0 && leadRows.length === 0 && <EmptyFilter filter={filter} />}
                    </>
                  )}
                </div>
              </section>

              <aside className="bento-fx xl:sticky xl:top-3 min-w-0">
                {selectedLead ? (
                  <LeadContext lead={selectedLead} task={selectedTask} interactions={interactions} loading={interactionsLoading}
                    noRadar={focus.has(selectedLead.id)} onToggleFocus={() => toggleFocus(selectedLead.id)}
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
          </>
        )}
      </div>

      {modalOpen && (
        <TaskModal key={modalKey} onClose={() => setModalOpen(false)} onSaved={handleSaved} currentUser={currentUser}
          linkOptions={linkOptions} task={editing} prefill={prefill} aiFilled={false} />
      )}

      {situation && (
        <SituationDrawer lead={{ id: situation.lead.id, name: situation.lead.name, status: situation.lead.status }} sourceTaskId={situation.taskId}
          taskContext={(() => {
            const task = situation.taskId ? tasks.find(row => row.id === situation.taskId) : null
            return task ? { title: task.title, kind: inferTaskKind(task.title, task.kind), dueTime: task.due_time } : null
          })()}
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

type TaskRowProps = {
  task: Task; active: boolean; today: string; busy: boolean
  onSelect: () => void; onToggle: () => void; onEdit: () => void
}

function TaskRow({ task, active, today, busy, onSelect, onToggle, onEdit }: TaskRowProps) {
  const overdue = !task.done && !!task.due_date && task.due_date < today
  const kind = inferTaskKind(task.title, task.kind)
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
          {kind === 'reuniao' ? <Video className="w-3.5 h-3.5 text-purple-400" />
            : kind === 'agendamento' ? <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
            : kind === 'ligacao' ? <Phone className="w-3.5 h-3.5 text-blue-400" />
            : kind === 'whatsapp' ? <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            : kind === 'proposta' ? <FileText className="w-3.5 h-3.5 text-amber-400" />
            : kind === 'followup' ? <RefreshCw className="w-3.5 h-3.5 text-lime-fg" />
            : <CircleDot className="w-3.5 h-3.5 text-bento-muted" />}
          <span className="text-[11px] text-bento-muted truncate">{task.linked_name ?? 'Tarefa geral'}</span>
          {task.priority !== 'normal' && <span className={cn('text-[9px] uppercase font-semibold', task.priority === 'urgente' ? 'text-red-400' : 'text-amber-400')}>{task.priority}</span>}
          <ChevronRight className="w-3.5 h-3.5 text-bento-muted ml-auto opacity-0 group-hover:opacity-100" />
        </div>
      </button>
    </div>
  )
}

// Linha de tarefa com o aviso de resíduo: este lead tem N tarefas abertas mais antigas que esta, que a
// lista escondeu para não mostrar a mesma pessoa três vezes. Fica visível e com saída em um clique —
// esconder sem dizer seria trocar um problema de ruído por um de confiança.
function TaskRowComDuplicadas({ antigas = 0, onResolver, ...props }: TaskRowProps & { antigas?: number; onResolver?: () => void }) {
  return (
    <div className="space-y-0">
      <TaskRow {...props} />
      {antigas > 0 && onResolver && (
        <div className="-mt-1 flex flex-wrap items-center gap-2 rounded-b-bento border border-t-0 border-bento-border bg-bento-bg/60 px-3 py-1.5">
          <span className="font-tech text-[10px] text-bento-muted">
            +{antigas} tarefa(s) mais antiga(s) deste lead, ocultas
          </span>
          <button type="button" onClick={onResolver} disabled={props.busy}
            className="font-tech text-[10px] text-lime-fg underline-offset-2 hover:underline disabled:opacity-50">
            encerrar antigas
          </button>
        </div>
      )}
    </div>
  )
}

// `mostrarEmpresa`: nos resultados de busca a segunda linha passa a ser EMPRESA · ESTÁGIO em vez da
// situação escrita. Quem busca por empresa precisa ver a empresa para confirmar que achou o lead certo —
// e o estágio diz onde ele está, inclusive quando é um fechado ou perdido.
function LeadRow({ lead, active, mostrarEmpresa, noRadar, onToggleFocus, onSelect }: {
  lead: MesaLead; active: boolean; mostrarEmpresa?: boolean; noRadar?: boolean
  onToggleFocus?: () => void; onSelect: () => void
}) {
  const temperature = lead.temperature ? TEMPERATURE_LABEL[lead.temperature as keyof typeof TEMPERATURE_LABEL] ?? lead.temperature : 'Sem avaliação'
  const estagio = STATUS_LABEL.get(lead.status) || lead.status
  const segundaLinha = mostrarEmpresa
    ? [lead.company, estagio].filter(Boolean).join(' · ')
    : (lead.current_situation || estagio)
  // A estrela é irmã do botão da linha, não filha: <button> dentro de <button> é HTML inválido e o
  // clique de dentro viraria seleção do lead.
  return (
    <div className={cn('flex items-center gap-2 rounded-bento border pr-2 transition-colors',
      active ? 'border-lime/50 bg-lime/[0.07]' : 'border-bento-border bg-bento-bg/35 hover:border-bento-dim/60')}>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
        <span className={cn('w-2 h-2 rounded-full shrink-0', HOT.has(lead.temperature ?? '') ? 'bg-lime' : COLD.has(lead.temperature ?? '') ? 'bg-blue-400' : 'bg-amber-400')} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-bento-text truncate">{lead.name}</span>
          <span className="block text-[11px] text-bento-muted truncate">{segundaLinha}</span>
        </span>
        <span className="text-[10px] text-bento-muted shrink-0">{temperature}</span>
      </button>
      {onToggleFocus && (
        <button type="button" onClick={onToggleFocus} aria-pressed={!!noRadar}
          aria-label={noRadar ? `Tirar ${lead.name} do radar` : `Acompanhar ${lead.name}`}
          title={noRadar ? 'Tirar do radar' : 'Acompanhar este lead'}
          className={cn('grid h-8 w-8 flex-none place-items-center rounded-btn transition-colors',
            noRadar ? 'text-lime-fg hover:bg-lime/10' : 'text-bento-muted hover:text-lime-fg hover:bg-bento-bg')}>
          <Star className={cn('h-4 w-4', noRadar && 'fill-current')} />
        </button>
      )}
      <ChevronRight className="w-4 h-4 text-bento-muted flex-none" />
    </div>
  )
}

function LeadContext({ lead, task, interactions, loading, noRadar, onToggleFocus, onNewTask, onEditTask, onSituation }: {
  lead: MesaLead; task: Task | null; interactions: Interaction[]; loading: boolean
  noRadar: boolean; onToggleFocus: () => void
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
          {/* A estrela fica AQUI, no painel aberto: é o momento em que se decide acompanhar — logo depois
              de falar com a pessoa. Ter que voltar para a lista para marcar seria a hora de desistir. */}
          <button type="button" onClick={onToggleFocus} aria-pressed={noRadar}
            aria-label={noRadar ? 'Tirar do radar' : 'Acompanhar este lead'}
            title={noRadar ? 'Acompanhando — clique para tirar do radar' : 'Acompanhar este lead'}
            className={cn('p-2 rounded-btn transition-colors', noRadar ? 'text-lime-fg hover:bg-lime/10' : 'text-bento-muted hover:text-lime-fg hover:bg-bento-bg')}>
            <Star className={cn('w-4 h-4', noRadar && 'fill-current')} />
          </button>
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
          <ContextBlock
            label="Próxima ação"
            value={lead.next_action && lead.next_action !== 'nenhuma'
              ? (isNextAction(lead.next_action) ? NEXT_ACTION_LABEL[lead.next_action] : lead.next_action.replaceAll('_', ' '))
              : 'Não definida'}
          />
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

        {/* Observações do lead — sempre visíveis aqui, não só na página dedicada (OBS-BOX-001). */}
        <ObservationsBox entityType="lead" entityId={lead.id} maxHeight="max-h-52" />

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
    hoje: 'Nada para hoje: nenhuma tarefa vence hoje e nenhum lead novo chegou.',
    atrasado: 'Nada atrasado. Dia em ordem.',
    acompanhando: 'Nenhum lead no radar. Use a estrela para marcar os que você está trabalhando.',
    reunioes: 'Nenhuma reunião pendente.', leads: 'Nenhum lead em andamento.',
    aguardando: 'Nenhum lead aguardando retorno.',
    proximas: 'Nenhuma próxima ação organizada.', atencao: 'Nenhuma ação vencida ou sem data.', concluidas: 'Nenhuma tarefa concluída recentemente.',
  }
  return <div className="py-16 text-center"><CheckCircle2 className="w-8 h-8 text-bento-muted mx-auto mb-3" /><p className="text-sm text-bento-dim">{messages[filter]}</p></div>
}
