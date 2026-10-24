'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDot,
  ExternalLink, FileText, Mail, MessageCircle, Phone, Plus, RefreshCw, Search, UserRound, Video, X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ymd, addDaysYmd, dowOfYmd } from '@/lib/date'
import { waNumber } from '@/lib/phone'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows'
import { useToast } from '@/components/ui/toast'
import { updateTaskAction } from '../../tarefas/task-write-actions'
import { closeStaleLeadTasksAction, closeTasksBatchAction } from './focus-actions'
import { useTasksState } from '../../tarefas/useTasksState'
import { TaskModal, type TaskPrefill } from '../../tarefas/TaskModal'
import type { LinkOption, Task } from '../../tarefas/types'
import { SituationDrawer } from '../SituationDrawer'
import { type LeadStatus } from '../types'
import { NEXT_ACTION_LABEL, TEMPERATURE_LABEL, isNextAction } from '@/lib/commercial/situation'
import { inferTaskKind } from '@/lib/tasks/task-kind'
import { closedStageSlugs } from '@/lib/commercial/closed-stages'
import { ObservationsBox } from '@/components/observations/ObservationsBox'
import { LimparAtrasados } from './LimparAtrasados'

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

export type FunnelStage = { slug: string; nome: string; posicao: number; cor: string | null; grupo: string | null; is_won: boolean; is_lost: boolean }

// QUATRO ABAS (MESA-ABAS-001). Eram nove — Hoje, Atrasado, Acompanhando, Reuniões, Leads, Aguardando,
// Próximas, Sem plano e Concluídas —, várias medindo recortes da mesma coisa com números que não batiam.
//
//   hoje        → o que vence no dia (com navegação por data)
//   semana      → as tarefas dos próximos 7 dias, agrupadas por dia (o que vem pela frente — era o único uso
//                 real da Agenda do Hall, que saiu)
//   acompanhando→ TODOS os leads em jogo, agrupados pela fase REAL do funil
//   reunioes    → só compromisso marcado
//   concluidas  → quem chegou ao fim: virou cliente ou disse não
//
// Atrasado deixou de ser aba: atraso virou um atributo da linha dentro da fase, não um lugar. Um lead não
// "é atrasado", ele está numa fase do funil — e é por fase que o trabalho acontece.
type Filter = 'hoje' | 'semana' | 'acompanhando' | 'reunioes' | 'concluidas'

// Fases que saem do fluxo de trabalho e vão para "Concluídas": as encerradas (closedStageSlugs, fonte única
// em lib/commercial/closed-stages — a mesma régua do rodapé do Funil).

// Fases que não entram em Tarefas. "Sem dados" (incompleto) é onde o webhook do Magnetic deixa o lead que
// chegou sem telefone: não há o que trabalhar ali — falta o dado para ligar. Ele continua no funil do
// Comercial, que é onde se resolve o cadastro.
const FASES_FORA_DAS_TAREFAS = new Set(['lixeira', 'incompleto'])
type Interaction = { id: string; type: string; note: string | null; created_by_name: string | null; created_at: string }

const HOT = new Set(['muito_quente', 'quente', 'muito_interessado', 'interessado'])
const COLD = new Set(['esfriando', 'frio', 'pouco_interessado'])


// Busca sem acento e sem caixa: a base tem "Gouvêa", "André", "Mizael". Exigir o acento certo faria a
// busca falhar justamente nos nomes que mais precisam dela.
// Anda dias numa chave 'YYYY-MM-DD' sem Date local — aritmética de fuso é a origem clássica do dia que pula.
const shiftDia = (ymdStr: string, delta: number): string => addDaysYmd(ymdStr, delta)
const rotuloDia = (alvo: string, hoje: string): string => {
  if (alvo === hoje) return 'Hoje'
  if (alvo === shiftDia(hoje, -1)) return 'Ontem'
  if (alvo === shiftDia(hoje, 1)) return 'Amanhã'
  const [y, m, d] = alvo.split('-')
  return `${d}/${m}/${y}`
}

const DIA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
// Cabeçalho do dia na visão Semana: Hoje / Amanhã / "Sex · 31/10".
const rotuloSemana = (alvo: string, hoje: string): string => {
  if (alvo === hoje) return 'Hoje'
  if (alvo === shiftDia(hoje, 1)) return 'Amanhã'
  const [, m, d] = alvo.split('-')
  return `${DIA_SEMANA[dowOfYmd(alvo)]} · ${d}/${m}`
}

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



export function MesaClient({ initialTasks, initialLeads, stages, linkOptions, currentUser, onOpenLead }: {
  initialTasks: Task[]
  initialLeads: MesaLead[]
  stages: FunnelStage[]
  linkOptions: LinkOption[]
  currentUser: { id: string; name: string }
  // Abre o diário completo do lead. A aba vive dentro do Comercial, que é dono do LeadDiary — antes era um
  // link para /comercial?lead=, que agora seria a própria página e não reabriria nada.
  onOpenLead: (leadId: string) => void
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
  const [busca, setBusca] = useState('')
  // DIA DE REFERÊNCIA da aba Hoje (MESA-DIA-001). Default = hoje. As setas andam um dia; "Hoje" volta.
  // Serve para revisar ontem sem caçar no meio dos 145 atrasados — que era o pedido.
  const [dia, setDia] = useState<string | null>(null)
  // Grupos do Atrasado fechados por padrão, menos o primeiro: abrir 130 linhas de uma vez recriaria a
  // pilha que o agrupamento existe para desfazer. `null` = ainda não mexeu, aí vale o padrão.
  // Grupo aberto no funil. O padrão (`null`) abre o PRIMEIRO; depois que a pessoa escolhe, vale a escolha.
  // Trocar de aba reseta: Acompanhando e Concluídas têm fases diferentes, e guardar o slug de uma na outra
  // deixava TODOS os grupos fechados — a tela abria vazia sem motivo aparente.
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null)
  const [limpando, setLimpando] = useState(false)
  const [limpezaBusy, setLimpezaBusy] = useState(false)

  const today = ymd(new Date())
  const closedSlugs = useMemo(() => closedStageSlugs(stages), [stages])
  // Nome da fase pelo funil REAL da equipe (antes uma lista fixa no código: fases novas como "Achou Caro"
  // apareciam como o slug cru, e "Venda Concluída" como "Venda Fechada").
  const stageName = useMemo(() => new Map(stages.map(st => [st.slug, st.nome])), [stages])
  const nomeFase = (slug: string) => stageName.get(slug) ?? slug
  const pending = useMemo(() => tasks.filter(task => !task.done).sort(taskSort), [tasks])

  // UMA LINHA POR LEAD, DENTRO DE CADA LISTA (MESA-DEDUP-002).
  //
  // A primeira versão deduplicava GLOBALMENTE, escolhendo por lead a tarefa criada mais recentemente. Duas
  // coisas quebraram, e as duas apareceram na base real:
  //   · 7 das 8 reuniões abertas sumiram da aba Reuniões, suprimidas por uma tarefa criada depois. A aba
  //     existe justamente para não perder compromisso marcado — ela nunca pode esconder nada.
  //   · O plano NOVO podia ser o escondido: Paulino tinha "Acompanhar proposta [07/10]" (atrasada) e
  //     "Ligar novamente [14/10]" (futura), criadas no mesmo dia; a atrasada venceu o desempate e a tela
  //     mostrava exatamente o contrário do que se queria.
  //
  // Agora cada lista decide sozinha, com o critério que faz sentido nela, e nenhuma suprime as outras.
  const umaPorLead = (lista: Task[], melhor: (a: Task, b: Task) => Task) => {
    const escolhida = new Map<string, Task>()
    const soltas: Task[] = []
    for (const task of lista) {
      if (task.linked_type !== 'lead' || !task.linked_id) { soltas.push(task); continue }
      const atual = escolhida.get(task.linked_id)
      escolhida.set(task.linked_id, atual ? melhor(atual, task) : task)
    }
    const vencedoras = new Set([...escolhida.values()].map(t => t.id))
    const ocultasPor = new Map<string, number>()
    for (const task of lista) {
      if (task.linked_type !== 'lead' || !task.linked_id || vencedoras.has(task.id)) continue
      const dona = escolhida.get(task.linked_id)
      if (dona) ocultasPor.set(dona.id, (ocultasPor.get(dona.id) ?? 0) + 1)
    }
    const avulsas = new Set(soltas.map(t => t.id))
    return { rows: lista.filter(t => vencedoras.has(t.id) || avulsas.has(t.id)), ocultasPor }
  }

  const maisNova = (a: Task, b: Task) => ((b.created_at ?? '') > (a.created_at ?? '') ? b : a)


  // HOJE = só o que é de hoje (MESA-HOJE-001). Antes era `due_date <= today`, então as atrasadas entravam
  // aqui e a aba abria com 133 itens — pilha, não lista de trabalho.
  // O contador da aba é SEMPRE do dia de hoje, mesmo navegando para ontem: é o sinal permanente na
  // lateral, e mudá-lo conforme a navegação faria o número piscar sem querer dizer nada.
  const tarefasDeHojeCount = useMemo(
    () => umaPorLead(pending.filter(t => t.due_date === today), maisNova).rows.length,
    [pending, today])

  const diaRef = dia ?? today
  const hoje = useMemo(() => umaPorLead(pending.filter(t => t.due_date === diaRef), maisNova),
    [pending, diaRef])
  const todayTasks = hoje.rows
  // Concluídas DAQUELE dia entram quando se olha para trás: revisar ontem sem ver o que foi feito mostraria
  // um dia vazio e daria a impressão errada de que nada andou.
  const doneNoDia = useMemo(() => dia && dia !== today
    ? tasks.filter(t => t.done && t.due_date === dia) : [], [tasks, dia, today])

  // VENCIDAS PARA O MUTIRÃO: TODA tarefa aberta com data passada, sem exceção.
  //
  // Antes esta lista excluía o lead que já tinha plano novo — regra herdada de quando "Atrasado" era uma
  // aba de trabalho, onde não fazia sentido cobrar quem já foi retomado. Para a LIMPEZA a regra é o
  // oposto: a tarefa antiga de um lead já replanejado é justamente o resíduo a encerrar, e excluí-la
  // tornava impossível limpá-la pela tela.
  const overdueTasks = useMemo(() => pending.filter(t => !!t.due_date && t.due_date < today), [pending, today])
  // Quantas linhas a aba Hoje escondeu por lead, para o aviso "+N mais antigas".
  const ocultasPorTarefa = hoje.ocultasPor

  // Leads que chegaram no dia em foco e ainda não têm tarefa — trabalho do dia tanto quanto uma tarefa.
  const newLeadsToday = useMemo(() => {
    const jaNasTarefas = new Set(todayTasks.filter(t => t.linked_type === 'lead').map(t => t.linked_id))
    // received_at é a data de entrada (o webhook do Magnetic preenche), com created_at de reserva.
    return leads.filter(lead => !closedSlugs.has(lead.status) &&
      (lead.received_at ?? lead.created_at ?? '').slice(0, 10) === diaRef &&
      !jaNasTarefas.has(lead.id))
  }, [leads, diaRef, todayTasks, closedSlugs])

  // SEMANA: tarefas abertas de hoje até +6 dias, por dia e por horário. Sem dedupe por lead — é a visão de
  // agenda: duas coisas marcadas no mesmo dia aparecem as duas (igual ao Google Agenda, que recebe as mesmas).
  const semanaDias = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dia = shiftDia(today, i)
    const itens = pending.filter(t => t.due_date === dia)
      .sort((a, b) => (a.due_time ?? '99:99').localeCompare(b.due_time ?? '99:99'))
    return { dia, itens }
  }), [pending, today])
  const semanaCount = semanaDias.reduce((n, d) => n + d.itens.length, 0)

  // REUNIÕES: sem dedupe nenhuma. Compromisso marcado não é resíduo — se existem duas, as duas aparecem.
  const meetingTasks = useMemo(() => pending.filter(task => inferTaskKind(task.title, task.kind) === 'reuniao'), [pending])

  // ── AGRUPAMENTO PELO FUNIL REAL (MESA-FUNIL-001) ────────────────────────────────────────────────
  // Uma linha por LEAD, dentro da fase em que ele está. Mudou de fase no Comercial? Muda de grupo aqui.
  // A ordem e os nomes saem de funnel_stages — a mesma tabela que desenha o funil —, então fase criada
  // lá aparece aqui sem tocar neste arquivo.
  const porFase = useMemo(() => {
    const tarefaDoLead = new Map<string, Task>()
    for (const task of pending) {
      if (task.linked_type !== 'lead' || !task.linked_id) continue
      const atual = tarefaDoLead.get(task.linked_id)
      // A tarefa que representa o lead é a de data mais próxima — é o próximo passo dele.
      if (!atual || (task.due_date ?? '9999') < (atual.due_date ?? '9999')) tarefaDoLead.set(task.linked_id, task)
    }

    const porSlug = new Map<string, { lead: MesaLead; task: Task | null }[]>()
    for (const lead of leads) {
      if (FASES_FORA_DAS_TAREFAS.has(lead.status)) continue
      const lista = porSlug.get(lead.status) ?? []
      lista.push({ lead, task: tarefaDoLead.get(lead.id) ?? null })
      porSlug.set(lead.status, lista)
    }

    const monta = (encerradas: boolean) => stages
      .filter(st => closedSlugs.has(st.slug) === encerradas && !FASES_FORA_DAS_TAREFAS.has(st.slug))
      .map(st => ({
        slug: st.slug, titulo: st.nome, cor: st.cor, grupo: st.grupo,
        // ORDEM: quem entrou na fase por último fica no topo (MESA-FUNIL-004). É a mesma régua do funil
        // do Comercial — mover um lead de fase o torna o mais recente dela. `stage_changed_at` é a data
        // dessa entrada; `created_at` só cobre o lead que nunca mudou de fase desde que chegou.
        //
        // Nada mais reordena, nem a data vencida. Numa lista cuja posição significa "ordem de chegada",
        // qualquer critério por cima tiraria o sentido de olhar para o topo. O atraso continua visível na
        // própria linha (etiqueta âmbar), que é onde ele informa sem mexer na posição.
        itens: (porSlug.get(st.slug) ?? []).sort((a, b) =>
          (b.lead.stage_changed_at ?? b.lead.created_at ?? '')
            .localeCompare(a.lead.stage_changed_at ?? a.lead.created_at ?? '')),
      }))
      .filter(g => g.itens.length > 0)

    return { ativas: monta(false), encerradas: monta(true) }
  }, [leads, pending, stages, closedSlugs])

  const acompanhandoCount = useMemo(() => porFase.ativas.reduce((n, g) => n + g.itens.length, 0), [porFase])
  // Mesma contagem que os cabeçalhos dos grupos somam — derivada do que está NA TELA (a tarefa que
  // representa o lead). Antes o cartão usava outra régua e marcava 95 onde os grupos somavam 96: duas
  // definições de "vencida" convivendo na mesma tela.
  const vencidasNoFunil = useMemo(() => porFase.ativas.reduce((n, g) =>
    n + g.itens.filter(x => x.task?.due_date && x.task.due_date < today).length, 0), [porFase, today])
  const concluidasCount = useMemo(() => porFase.encerradas.reduce((n, g) => n + g.itens.length, 0), [porFase])

  const selectedTask = selectedTaskId ? tasks.find(task => task.id === selectedTaskId) ?? null : null
  const selectedLead = selectedLeadId ? leads.find(lead => lead.id === selectedLeadId) ?? null : null
  const temSelecao = !!selectedLead || !!selectedTask
  function fecharPainel() { setSelectedLeadId(null); setSelectedTaskId(null) }

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
    { id: 'hoje', label: 'Hoje', Icon: CircleDot, count: tarefasDeHojeCount + newLeadsToday.length },
    { id: 'semana', label: 'Semana', Icon: CalendarDays, count: semanaCount },
    { id: 'acompanhando', label: 'Acompanhando', Icon: UserRound, count: acompanhandoCount },
    { id: 'reunioes', label: 'Reuniões', Icon: Video, count: meetingTasks.length },
    { id: 'concluidas', label: 'Concluídas', Icon: CheckCircle2, count: concluidasCount },
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

  const taskRows = filter === 'hoje' ? todayTasks : filter === 'reunioes' ? meetingTasks : []
  const leadRows = filter === 'hoje' ? newLeadsToday : []
  // Os grupos do funil alimentam Acompanhando e Concluídas — a mesma estrutura, recortes diferentes.
  const gruposDoFunil = filter === 'acompanhando' ? porFase.ativas : filter === 'concluidas' ? porFase.encerradas : []

  function selectTask(task: Task) {
    setSelectedTaskId(task.id)
    setSelectedLeadId(task.linked_type === 'lead' ? task.linked_id ?? null : null)
  }

  // Encerra as tarefas antigas do lead, mantendo a atual. É a saída para o resíduo que a dedupe revela.
  // Mutirão: encerra em lote o que a pessoa marcou e confirmou na tela de revisão.
  async function encerrarLote(ids: string[]) {
    if (ids.length === 0) return
    setLimpezaBusy(true)
    const r = await closeTasksBatchAction(ids)
    setLimpezaBusy(false)
    if (!r.ok) { toast({ type: 'error', message: r.error ?? 'Não foi possível encerrar.' }); return }
    const fechadas = new Set(ids)
    setTasks(atual => atual.map(t => fechadas.has(t.id) ? { ...t, done: true } : t))
    setLimpando(false)
    toast({ type: 'success', message: `${r.fechadas} tarefa(s) encerrada(s).` })
  }

  async function resolverDuplicadas(task: Task) {
    if (!task.linked_id || (ocultasPorTarefa.get(task.id) ?? 0) === 0) return
    const leadId = task.linked_id
    setBusyTaskId(task.id)
    const r = await closeStaleLeadTasksAction(leadId, task.id)
    setBusyTaskId(null)
    if (!r.ok) { toast({ type: 'error', message: r.error ?? 'Não foi possível fechar as duplicadas.' }); return }
    // Fecha localmente as OUTRAS abertas deste lead — a mesma regra que a action aplicou no servidor.
    setTasks(atual => atual.map(t =>
      t.linked_type === 'lead' && t.linked_id === leadId && t.id !== task.id && !t.done
        ? { ...t, done: true } : t))
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

  // CHECK NA LINHA DO LEAD (MESA-FUNIL-003). Em Acompanhando o trabalho é por LEAD, não por tarefa, e
  // nem todo lead tem tarefa aberta — 95 estão sem próximo passo. Com tarefa, o check conclui e abre o
  // formulário (mesmo caminho do check da aba Hoje); sem tarefa, abre o formulário direto, que é o único
  // jeito de registrar o que aconteceu e definir o passo seguinte.
  function registrarSituacao(lead: MesaLead, task: Task | null) {
    if (task) { void toggleTask(task); return }
    setSituation({ lead, taskId: null })
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

  return (
    <div className="min-h-full bg-bento-bg font-body">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-4">
        {/* Barra compacta: a aba vive dentro do Comercial, que já tem título — saudação aqui seria um
            segundo cabeçalho empurrando a lista para baixo. O Relatório saiu daqui: mora em Resultados. */}
        <header className="flex items-center justify-end gap-2 flex-wrap">
          <button type="button" onClick={() => openNew()} className="bento-btn inline-flex items-center gap-2 px-4 min-h-[42px] rounded-btn text-sm font-semibold">
            <Plus className="w-4 h-4" /> Nova tarefa
          </button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[184px_minmax(0,1fr)_360px] gap-3 items-start">
          <nav className="bento-fx p-2 xl:sticky xl:top-3" aria-label="Organização da mesa">
            <div className="flex xl:flex-col gap-1 overflow-x-auto scrollbar-none">
              {filters.map(item => (
                <button key={item.id} type="button"
                  onClick={() => { setFilter(item.id); setGrupoAberto(null) }}
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
                  {buscando ? 'Busca de leads'
                    : filter === 'hoje' ? rotuloDia(diaRef, today)
                    : filters.find(item => item.id === filter)?.label}
                </h2>
                <p className="text-xs text-bento-muted mt-0.5">
                  {buscando
                    ? `${resultados.length} ${resultados.length === 1 ? 'lead encontrado' : 'leads encontrados'}`
                    : filter === 'semana'
                      ? `${semanaCount} ${semanaCount === 1 ? 'tarefa' : 'tarefas'} nos próximos 7 dias`
                    : gruposDoFunil.length > 0
                      ? `${gruposDoFunil.reduce((n, g) => n + g.itens.length, 0)} lead(s) em ${gruposDoFunil.length} fase(s)`
                      : `${taskRows.length || leadRows.length} ${taskRows.length + leadRows.length === 1 ? 'item' : 'itens'}`}
                  {filter === 'hoje' && dia && dia !== today && doneNoDia.length > 0 &&
                    ` · ${doneNoDia.length} concluída(s)`}
                  {/* Aviso de atraso: era um cartão no topo da Mesa; agora fica onde se resolve. */}
                  {filter === 'acompanhando' && !buscando && vencidasNoFunil > 0 && (
                    <span className="text-amber-600 dark:text-amber-300"> · {vencidasNoFunil} com data vencida</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Navegação por DIA, só na aba Hoje: rever ontem sem caçar no meio dos atrasados. */}
                {filter === 'hoje' && !buscando && (
                  <>
                    <button type="button" onClick={() => setDia(shiftDia(diaRef, -1))} aria-label="Dia anterior"
                      className="grid h-8 w-8 place-items-center rounded-btn border border-bento-border text-bento-muted transition-colors hover:border-lime hover:text-bento-text">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setDia(shiftDia(diaRef, 1))} aria-label="Próximo dia"
                      className="grid h-8 w-8 place-items-center rounded-btn border border-bento-border text-bento-muted transition-colors hover:border-lime hover:text-bento-text">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    {diaRef !== today && (
                      <button type="button" onClick={() => setDia(null)}
                        className="rounded-btn border border-bento-border px-2.5 py-1.5 font-tech text-[11px] text-bento-muted transition-colors hover:border-lime hover:text-bento-text">
                        Hoje
                      </button>
                    )}
                    <input type="date" value={diaRef} onChange={e => setDia(e.target.value || null)}
                      aria-label="Escolher dia"
                      className="h-8 rounded-btn border border-bento-border bg-bento-bg px-2 font-tech text-[11px] text-bento-muted focus:border-lime focus:outline-none" />
                  </>
                )}
                {filter === 'acompanhando' && overdueTasks.length > 0 && !buscando && (
                  <button type="button" onClick={() => setLimpando(true)}
                    className="rounded-btn border border-bento-border px-2.5 py-1.5 font-tech text-[11px] text-bento-muted transition-colors hover:border-lime hover:text-bento-text">
                    Limpar vencidas
                  </button>
                )}
                <button type="button" onClick={() => router.refresh()} aria-label="Atualizar" className="p-2 text-bento-muted hover:text-bento-text rounded-btn hover:bg-bento-bg">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
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
              {filter === 'semana' && !buscando ? (
                semanaCount === 0 ? <EmptyFilter filter="semana" /> : (
                  <div className="space-y-4">
                    {semanaDias.filter(d => d.itens.length > 0).map(({ dia, itens }) => (
                      <div key={dia} className="space-y-2">
                        <p className="flex items-center gap-2 px-1 font-tech text-[10px] uppercase tracking-label text-bento-muted">
                          <span className={cn(dia === today && 'text-lime-fg')}>{rotuloSemana(dia, today)}</span>
                          <span className="tabular-nums opacity-70">{itens.length}</span>
                          <span className="h-px flex-1 bg-bento-border/60" aria-hidden />
                        </p>
                        {itens.map(task => (
                          <TaskRow key={task.id} task={task} active={selectedTaskId === task.id} today={today}
                            busy={busyTaskId === task.id} onSelect={() => selectTask(task)}
                            onToggle={() => toggleTask(task)} onEdit={() => openEdit(task)} />
                        ))}
                      </div>
                    ))}
                  </div>
                )
              ) : gruposDoFunil.length > 0 && !buscando ? (
                /* FUNIL (MESA-FUNIL-002). Três superfícies em profundidade decrescente para separar o
                   que é fase do que é lead: o cartão da fase em `bento-panel`, o corpo aberto recuado
                   em `bento-bg` (a cor da própria página, que vira um "poço"), e os leads de volta em
                   `bento-panel` dentro dele. Card claro > poço > card claro: o lead destaca do grupo
                   sem precisar de borda forte, e duas fases abertas nunca se confundem.
                   A cor da fase entra como trilho à esquerda e como fio-guia vertical no poço — é a
                   mesma cor do funil do Comercial, então a leitura é imediata. */
                <div className="space-y-2.5">
                  {gruposDoFunil.map((grupo, i) => {
                    const aberto = grupoAberto ? grupoAberto === grupo.slug : i === 0
                    const atrasados = grupo.itens.filter(x => x.task?.due_date && x.task.due_date < today).length
                    const cor = grupo.cor ?? '#8A9182'
                    return (
                      <div key={grupo.slug}
                        className={cn('relative overflow-hidden rounded-bento border bg-bento-panel transition-all duration-200',
                          aberto ? 'border-bento-dim/40 shadow-card' : 'border-bento-border hover:border-bento-dim/40')}>
                        {/* Trilho da fase, na cor do funil */}
                        <span aria-hidden className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: cor }} />

                        <button type="button"
                          onClick={() => setGrupoAberto(aberto ? '__nenhum__' : grupo.slug)}
                          aria-expanded={aberto}
                          className="flex w-full items-center gap-3 py-3.5 pl-4 pr-3.5 text-left">
                          <ChevronDown className={cn('h-4 w-4 shrink-0 text-bento-muted transition-transform duration-200', aberto && 'rotate-180')} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold tracking-tight text-bento-text">{grupo.titulo}</span>
                            {atrasados > 0 && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-tech text-[10px] text-amber-600 dark:text-amber-300">
                                {atrasados} com data vencida
                              </span>
                            )}
                          </span>
                          <span className={cn('grid h-7 min-w-[28px] flex-none place-items-center rounded-full border px-2 font-tech text-[11px] tabular-nums transition-colors',
                            aberto ? 'border-transparent bg-bento-text text-bento-panel' : 'border-bento-border bg-bento-bg text-bento-dim')}>
                            {grupo.itens.length}
                          </span>
                        </button>

                        {aberto && (
                          <div className="relative border-t border-bento-border bg-bento-bg px-2.5 py-2.5">
                            {/* Fio-guia: amarra visualmente os leads à fase de onde saíram */}
                            <span aria-hidden className="absolute bottom-3 left-[14px] top-3 w-px rounded-full opacity-40"
                              style={{ backgroundColor: cor }} />
                            <div className="space-y-1.5 pl-5">
                              {grupo.itens.map(({ lead, task }) => (
                                <LeadNaFase key={lead.id} lead={lead} task={task} today={today}
                                  active={selectedLeadId === lead.id}
                                  busy={!!task && busyTaskId === task.id}
                                  onCheck={() => registrarSituacao(lead, task)}
                                  onSelect={() => { selectLead(lead); if (task) setSelectedTaskId(task.id) }} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : buscando ? (
                resultados.length === 0 ? (
                  <p className="px-2 py-10 text-center text-sm text-bento-muted">
                    Nenhum lead com “{busca.trim()}” no nome ou na empresa.
                  </p>
                ) : resultados.map(lead => (
                  <LeadRow key={lead.id} lead={lead} estagio={nomeFase(lead.status)} active={selectedLeadId === lead.id}
                    mostrarEmpresa onSelect={() => selectLead(lead)} />
                ))
              ) : (
                <>
                  {taskRows.map(task => (
                    <TaskRowComDuplicadas key={task.id} task={task} active={selectedTaskId === task.id} today={today}
                      busy={busyTaskId === task.id}
                      antigas={filter === 'hoje' ? (ocultasPorTarefa.get(task.id) ?? 0) : 0}
                      onResolver={() => resolverDuplicadas(task)}
                      onSelect={() => selectTask(task)} onToggle={() => toggleTask(task)} onEdit={() => openEdit(task)} />
                  ))}
                  {leadRows.map(lead => (
                    <LeadRow key={lead.id} lead={lead} estagio={nomeFase(lead.status)} active={selectedLeadId === lead.id}
                      mostrarEmpresa onSelect={() => selectLead(lead)} />
                  ))}
                  {filter === 'hoje' && doneNoDia.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="px-1 font-tech text-[10px] uppercase tracking-label text-bento-muted">
                        Concluídas neste dia
                      </p>
                      {doneNoDia.map(task => (
                        <TaskRow key={task.id} task={task} active={selectedTaskId === task.id} today={today}
                          busy={busyTaskId === task.id} onSelect={() => selectTask(task)}
                          onToggle={() => toggleTask(task)} onEdit={() => openEdit(task)} />
                      ))}
                    </div>
                  )}
                  {taskRows.length === 0 && leadRows.length === 0 && doneNoDia.length === 0 && <EmptyFilter filter={filter} />}
                </>
              )}
            </div>
          </section>

          {/* PAINEL DO ITEM. Desktop largo (xl): terceira coluna fixa ao lado da lista, como sempre foi.
              Celular/iPad: abria EMBAIXO da lista inteira e era preciso rolar até ele; agora sobe POR CIMA
              (folha), com fundo escurecido e botão de fechar. z-190: acima da lista, abaixo dos avisos (200) e
              dos formulários que o próprio painel abre (300). */}
          {temSelecao && (
            <button type="button" aria-label="Fechar painel" onClick={fecharPainel}
              className="fixed inset-0 z-[185] bg-black/60 backdrop-blur-sm xl:hidden" />
          )}
          <aside className={cn('bento-fx min-w-0 xl:block xl:sticky xl:top-3',
            temSelecao
              ? 'fixed inset-x-0 bottom-0 top-[max(3rem,env(safe-area-inset-top))] z-[190] overflow-y-auto overscroll-contain animate-slide-up pb-[env(safe-area-inset-bottom)] xl:inset-auto xl:top-3 xl:z-auto xl:overflow-visible xl:animate-none xl:pb-0'
              : 'hidden')}>
            {temSelecao && (
              <div className="xl:hidden sticky top-0 z-10 flex justify-end border-b border-bento-border bg-bento-panel px-2 py-1.5">
                <button type="button" onClick={fecharPainel}
                  className="inline-flex items-center gap-1.5 rounded-btn px-3 min-h-[44px] text-sm text-bento-muted hover:text-bento-text">
                  <X className="h-4 w-4" /> Fechar
                </button>
              </div>
            )}
            {selectedLead ? (
              <LeadContext lead={selectedLead} estagio={nomeFase(selectedLead.status)} task={selectedTask} interactions={interactions} loading={interactionsLoading}
                onNewTask={() => openNew(selectedLead)} onEditTask={selectedTask ? () => openEdit(selectedTask) : undefined}
                onSituation={() => setSituation({ lead: selectedLead, taskId: null })}
                onOpenLead={() => onOpenLead(selectedLead.id)} />
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

      {limpando && (
        <LimparAtrasados tasks={overdueTasks} today={today} busy={limpezaBusy}
          onFechar={() => setLimpando(false)} onConfirmar={encerrarLote} />
      )}

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


// LINHA DO LEAD DENTRO DA FASE (MESA-FUNIL-001). É a unidade de trabalho de Acompanhando e Concluídas:
// quem é o lead, em que situação ele está e qual o próximo passo — tudo numa linha.
//
// Mostra a SITUAÇÃO escrita (current_situation) em vez do título da tarefa: na hora de decidir o que
// fazer, "pediu para ligar entre terça e quarta" vale mais que "Ligar novamente: Fulano". O próximo passo
// aparece como data à direita, em âmbar quando já venceu — atraso virou atributo da linha, não uma aba.
function LeadNaFase({ lead, task, today, active, busy, onCheck, onSelect }: {
  lead: MesaLead; task: Task | null; today: string; active: boolean; busy: boolean
  onCheck: () => void; onSelect: () => void
}) {
  const vencida = !!task?.due_date && task.due_date < today
  const semPlano = !task
  const situacao = lead.current_situation?.trim() || lead.company?.trim() || 'Sem situação registrada'
  return (
    <div className={cn(
      // Cartão CLARO sobre o poço escuro/acinzentado do grupo — é essa inversão que separa o lead da fase.
      'group flex items-center gap-2 rounded-btn border bg-bento-panel pr-2.5 transition-all duration-150',
      active
        ? 'border-lime/60 shadow-card ring-1 ring-lime/20'
        : 'border-bento-border/80 hover:border-bento-dim/50 hover:shadow-card')}>
      {/* Check: irmão do botão da linha (button dentro de button é HTML inválido). Conclui a tarefa e
          abre o formulário de situação; sem tarefa, abre o formulário direto. */}
      <button type="button" onClick={onCheck} disabled={busy}
        aria-label={task ? `Concluir e registrar situação de ${lead.name}` : `Registrar situação de ${lead.name}`}
        title={task ? 'Concluir e registrar a situação' : 'Registrar a situação'}
        className={cn('ml-2.5 grid h-5 w-5 flex-none place-items-center rounded-md border transition-colors',
          'border-bento-border text-transparent hover:border-lime hover:text-lime-fg disabled:opacity-40')}>
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 text-left">
        <span className={cn('h-2 w-2 shrink-0 rounded-full ring-2 ring-bento-panel',
          HOT.has(lead.temperature ?? '') ? 'bg-lime'
            : COLD.has(lead.temperature ?? '') ? 'bg-blue-400' : 'bg-amber-400')} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight text-bento-text">{lead.name}</span>
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-bento-muted">{situacao}</span>
        </span>
        {/* Próximo passo como etiqueta: vencido em âmbar, "sem próximo passo" com contorno tracejado —
            a ausência de plano precisa parecer uma lacuna, não um estado normal. */}
        {semPlano ? (
          <span className="flex-none rounded-full border border-dashed border-amber-500/40 px-2 py-0.5 font-tech text-[10px] text-amber-600 dark:text-amber-300">
            sem próximo passo
          </span>
        ) : (
          <span className={cn('flex-none whitespace-nowrap rounded-full border px-2 py-0.5 font-tech text-[10px] tabular-nums',
            vencida
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
              : 'border-bento-border bg-bento-bg text-bento-dim')}>
            {dateLabel(task.due_date, task.due_time)}
          </span>
        )}
      </button>
    </div>
  )
}

// `mostrarEmpresa`: nos resultados de busca a segunda linha passa a ser EMPRESA · ESTÁGIO em vez da
// situação escrita. Quem busca por empresa precisa ver a empresa para confirmar que achou o lead certo —
// e o estágio diz onde ele está, inclusive quando é um fechado ou perdido.
function LeadRow({ lead, estagio, active, mostrarEmpresa, onSelect }: {
  lead: MesaLead; estagio: string; active: boolean; mostrarEmpresa?: boolean; onSelect: () => void
}) {
  const temperature = lead.temperature ? TEMPERATURE_LABEL[lead.temperature as keyof typeof TEMPERATURE_LABEL] ?? lead.temperature : 'Sem avaliação'
  const segundaLinha = mostrarEmpresa
    ? [lead.company, estagio].filter(Boolean).join(' · ')
    : (lead.current_situation || estagio)
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
      <ChevronRight className="w-4 h-4 text-bento-muted flex-none" />
    </div>
  )
}

function LeadContext({ lead, estagio, task, interactions, loading, onNewTask, onEditTask, onSituation, onOpenLead }: {
  lead: MesaLead; estagio: string; task: Task | null; interactions: Interaction[]; loading: boolean
  onNewTask: () => void; onEditTask?: () => void; onSituation: () => void; onOpenLead: () => void
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
          <button type="button" onClick={onOpenLead} aria-label="Abrir lead completo" title="Abrir lead completo" className="p-2 rounded-btn text-bento-muted hover:text-lime-fg hover:bg-bento-bg">
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge>{estagio}</Badge>
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
    semana: 'Nenhuma tarefa marcada para os próximos 7 dias.',
    acompanhando: 'Nenhum lead em jogo no funil.',
    reunioes: 'Nenhuma reunião marcada.',
    concluidas: 'Ninguém chegou ao fim do funil ainda.',
  }
  return <div className="py-16 text-center"><CheckCircle2 className="w-8 h-8 text-bento-muted mx-auto mb-3" /><p className="text-sm text-bento-dim">{messages[filter]}</p></div>
}
