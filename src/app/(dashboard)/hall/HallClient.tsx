'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/system/TimeAgo'
import { Panel } from '@/components/bento/Panel'
import { LiveDot } from '@/components/bento/LiveDot'
import { NewsSection } from './NewsSection'
import { CollapsibleSection } from '@/components/mobile/CollapsibleSection'
import { MetricCard } from '@/components/ui/MetricCard'
import { X, Clock, CalendarDays, Activity as ActivityIcon, Newspaper, UserPlus, ArrowRight, AlertTriangle } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import type { Activity } from '@/types'
import type { Task, LinkOption } from '../tarefas/types'
import type { MapLead, MapClient } from '../comercial/mapTypes'
import type { DashboardData } from '@/server/services/DashboardService'
import { useTasksState } from '../tarefas/useTasksState'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { Calendar } from './Calendar'
import { type CalendarEvent } from './calendarShared'
import { dayBR } from './dateBR'
import dynamic from 'next/dynamic'
import { getHallSettings, DEFAULT_HALL_SETTINGS, HALL_SETTINGS_EVENT, type HallSettings } from '@/lib/hallSettings'
import { useMapPrefs } from '@/lib/mapPrefs'
import { toLeadMarkers } from '@/lib/leadMarkers'
// LeadMap (mapa de leads 3D/vidro, geografia us-atlas) — só no client, sob demanda. A config (Vista/Modo/
// Tema/inclinação) vem de Configurações > Mapa (localStorage 'mapPrefs'); a barra de controle saiu do mapa.
const LeadMap = dynamic(() => import('@/components/map/LeadMap'), { ssr: false })

// Fallback discreto (DS-005) enquanto o chunk da aba carrega.
function HallSectionLoading() {
  return <div className="py-16 text-center text-sm text-bento-muted">Carregando…</div>
}
// Componentes pesados EXCLUSIVOS de abas nao-default (agent/relatorio/tarefas) — fora do bundle
// inicial da /hall. So baixam ao abrir a aba; nao aparecem no first paint da Visao Geral (PERF-003).
// (AgentChat arrasta react-markdown/remark-gfm; TarefasClient ~43KB; RelatorioComercial idem.)
const AgentChat = dynamic(() => import('./AgentChat').then(m => m.AgentChat), { ssr: false, loading: HallSectionLoading })
const TarefasClient = dynamic(() => import('../tarefas/TarefasClient').then(m => m.TarefasClient), { ssr: false, loading: HallSectionLoading })
const RelatorioComercial = dynamic(() => import('../tarefas/RelatorioComercial').then(m => m.RelatorioComercial), { ssr: false, loading: HallSectionLoading })

type Tab = 'activities' | 'mapa' | 'tarefas' | 'relatorio' | 'agent'

interface Props {
  initialActivities: Activity[]
  initialTasks: Task[]
  linkOptions: LinkOption[]
  userName: string
  userId: string
  dashboard: DashboardData
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  lead: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  client: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  payment: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  task: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  campaign: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
  system: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>,
}

// Status semânticos (não-acento): cores próprias preservadas nos dois temas.
const ACTIVITY_COLORS: Record<string, string> = {
  lead:     'bg-blue-900/40 text-blue-400',
  client:   'bg-lime/15 text-lime-fg',
  payment:  'bg-green-900/40 text-green-400',
  task:     'bg-amber-900/40 text-amber-400',
  campaign: 'bg-purple-900/40 text-purple-400',
  system:   'bg-slate-800/60 text-slate-400',
}

function computeGreeting(): string {
  // Fuso canônico do app (Brasília) — não depende do fuso do navegador (B6).
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false })) % 24
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// Linha de evento de agenda no Mural (compacta, 1 linha; toca pra abrir no Calendar).
function MuralAgendaRow({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-2 text-left rounded-bento border border-lime/30 px-3 py-2 hover:border-lime/60 transition-colors">
      <Clock className="w-3.5 h-3.5 text-lime-fg flex-none" />
      <span className="text-sm text-bento-text truncate flex-1 min-w-0">{ev.title}</span>
      {ev.start_time && <span className="font-tech text-[11px] text-bento-muted flex-none tabular-nums">{ev.start_time.slice(0, 5)}</span>}
    </button>
  )
}

// Linha de tarefa no Mural (compacta, 1 linha). O Mural mostra só tarefas de HOJE pendentes,
// então o ponto lime = "do dia". Título trunca em 1 linha. Toca → aba Tarefas.
function MuralTaskRow({ task, onClick, overdue = false }: { task: Task; onClick: () => void; overdue?: boolean }) {
  const hora = task.due_time ? task.due_time.slice(0, 5) : ''
  return (
    <button type="button" onClick={onClick}
      className={cn('w-full flex items-center gap-2 text-left rounded-bento border px-3 py-2 transition-colors',
        overdue ? 'border-amber-500/40 hover:border-amber-500/70' : 'border-bento-border hover:border-lime/60')}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-none', overdue ? 'bg-amber-400' : 'bg-lime')} />
      <span className="text-sm text-bento-text truncate flex-1 min-w-0">{task.title}</span>
      {overdue
        ? <span className="font-tech text-[10px] uppercase tracking-wide text-amber-400 flex-none">Pendente</span>
        : hora && <span className="font-tech text-[11px] text-bento-muted flex-none tabular-nums">{hora}</span>}
    </button>
  )
}

// Modal "ver histórico": abre com os itens já em memória (view maior) e, no botão
// "Ver histórico", busca o histórico PERSISTIDO inteiro da tabela (activities/notices).
function HistoryModal({ onClose }: { onClose: () => void }) {
  const PAGE = 200
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Pagina do banco do mais recente pro mais antigo (lotes de 200, via .range). Só leitura.
  const loadMore = async () => {
    if (loading) return
    setLoading(true)
    const supabase = createClient()
    const from = items.length
    const { data } = await supabase.from('activities').select('*')
      .order('created_at', { ascending: false }).range(from, from + PAGE - 1)
    const rows = (data ?? []) as Activity[]
    setItems(prev => [...prev, ...rows])
    setHasMore(rows.length === PAGE)
    setLoading(false)
  }
  // Carrega o 1º lote ao abrir; "Carregar mais" busca os próximos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMore() }, [])

  const title = 'Atividade Recente'

  const { ref, dialogProps } = useDialog(onClose)
  return (
    <Portal>
    <div className="fixed inset-0 z-[300] flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div ref={ref} {...dialogProps} aria-labelledby="history-modal-title" className="relative w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[82vh] bg-bento-panel border border-bento-border rounded-none sm:rounded-bento shadow-card-hover flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-bento-border shrink-0">
          <h3 id="history-modal-title" className="font-display font-bold text-bento-text">{title} — Histórico</h3>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-bento-muted hover:text-bento-text hover:bg-bento-bg transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && items.length === 0 ? (
            <p className="text-sm text-bento-muted text-center py-10">Carregando histórico…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-bento-muted text-center py-10">Nada registrado ainda.</p>
          ) : (
            <div className="divide-y divide-bento-border/60">
              {items.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[a.type] ?? 'bg-slate-800/60 text-slate-400'}`}>{ACTIVITY_ICONS[a.type]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-bento-text leading-snug">{a.description}</p>
                    <p className="font-tech text-xs text-bento-muted mt-0.5">{a.user_name ? `${a.user_name} · ` : ''}<TimeAgo date={a.created_at} /></p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {items.length > 0 && (
            <div className="pt-3 text-center">
              {hasMore ? (
                <button onClick={loadMore} disabled={loading}
                  className="font-tech text-[11px] uppercase tracking-wide text-lime-fg hover:text-lime transition-colors font-semibold disabled:opacity-50 min-h-[36px]">
                  {loading ? 'Carregando…' : 'Carregar mais'}
                </button>
              ) : (
                <p className="font-tech text-[10px] text-bento-muted">Fim do histórico · {items.length} {items.length === 1 ? 'registro' : 'registros'}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </Portal>
  )
}

// ─── Main HallClient ──────────────────────────────────────────────────────────

// Divisor de secao discreto: rotulo pequeno + fio fino (sem caixa/borda pesada). Usado na Visao Geral.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="font-tech text-[11px] uppercase tracking-[0.15em] text-bento-muted shrink-0">{children}</span>
      <span className="h-px flex-1 bg-bento-border/50" aria-hidden />
    </div>
  )
}

export function HallClient({ initialActivities, initialTasks, linkOptions, userName, userId, dashboard }: Props) {
  // M6: estado de tarefas VIVO e ÚNICO — Tarefas + Mural + Agenda leem a MESMA fonte (realtime + merge A5).
  const { tasks, setTasks, deletedIds } = useTasksState(initialTasks)
  const [activeTab, setActiveTab]     = useState<Tab>('activities')
  const [activities, setActivities]   = useState<Activity[]>(initialActivities)
  // Reflete dados frescos do servidor após router.refresh() (revalidação ao focar a aba).
  useEffect(() => { setActivities(initialActivities) }, [initialActivities])
  const [greeting, setGreeting]       = useState('')
  const [today, setToday]             = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [calEvents, setCalEvents]     = useState<CalendarEvent[]>([])
  const [focusEvent, setFocusEvent]   = useState<CalendarEvent | null>(null)
  const [activitiesExpanded, setActivitiesExpanded] = useState(false)
  // Mapa + métricas (leads/clientes do banco) e config da Visão Geral (por usuário).
  const [mapLeads, setMapLeads]   = useState<MapLead[]>([])
  const [mapClients, setMapClients] = useState<MapClient[]>([])
  // Mapa: config (Vista/Modo/Tema/inclinação) vem de Configurações > Mapa (mapPrefs, reativo) + dados REAIS
  // (leads/clients) convertidos em markers do LeadMap. Config salva = fonte ÚNICA da renderização.
  const mapPrefs = useMapPrefs()
  const mapMarkers = useMemo(() => toLeadMarkers(mapLeads, mapClients), [mapLeads, mapClients])
  const [hallCfg, setHallCfg]     = useState<HallSettings>(DEFAULT_HALL_SETTINGS)
  const router = useRouter()

  // Deep-link: /hall?tab=tarefas (vindo do redirect de /tarefas) abre a aba certa.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'tarefas' || t === 'agent' || t === 'activities' || t === 'mapa' || t === 'relatorio') setActiveTab(t as Tab)
  }, [])

  useEffect(() => {
    setGreeting(computeGreeting())
    setToday(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }, [])

  // Config da Visão Geral (por usuário, localStorage) — lida no client p/ não dar hydration mismatch.
  useEffect(() => {
    const sync = () => setHallCfg(getHallSettings(userId))
    sync()
    window.addEventListener(HALL_SETTINGS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(HALL_SETTINGS_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [userId])

  // Leads + clientes p/ o MAPA e as MÉTRICAS (campos leves) — SÓ LEITURA. Refetcha ao montar, ao
  // voltar pra aba (foco/visível) e ao abrir a aba Mapa, p/ as métricas baterem com a aba Clientes
  // sem precisar de F5 (o problema era ficar com o snapshot do mount).
  const lastMapFetch = useRef(0)
  const fetchMapData = useCallback((force = false) => {
    // Throttle: no máximo 1 refetch a cada 30s (foco/visibilidade são barulhentos). force=true ignora.
    const nowMs = Date.now()
    if (!force && nowMs - lastMapFetch.current < 30_000) return
    lastMapFetch.current = nowMs
    const supabase = createClient()
    supabase.from('leads').select('id, name, status, state, area_code, created_at, origem').then(({ data }) => { if (data) setMapLeads(data as MapLead[]) })
    supabase.from('clients').select('id, name, status, state, area_code').then(({ data }) => { if (data) setMapClients(data as MapClient[]) })
  }, [])

  useEffect(() => {
    fetchMapData(true)   // carga inicial (força)
    // 'focus' removido (disparava a cada clique na janela/alt-tab); visibilitychange basta (e é throttled).
    const onVisible = () => { if (document.visibilityState === 'visible') fetchMapData() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchMapData])

  // Abrir/alternar p/ a aba Mapa revalida (throttled — nunca fica >30s desatualizado).
  useEffect(() => { if (activeTab === 'mapa') fetchMapData() }, [activeTab, fetchMapData])

  // Agenda (uma carga) + realtime de atividades.
  useEffect(() => {
    const supabase = createClient()
    supabase.from('calendar_events').select('*').eq('user_id', userId).order('date').then(({ data }) => { if (data) setCalEvents(data as CalendarEvent[]) })

    const dataChannel = supabase.channel('hall-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' },
        p => setActivities(prev => [p.new as Activity, ...prev.slice(0, 19)]))
      .subscribe()
    return () => { dataChannel.unsubscribe().then(() => supabase.removeChannel(dataChannel)) }
  }, [userId])

  // ── Mural ↔ Agenda: MESMA fonte (tasks vivo do useTasksState, idêntica à do Calendar) ──────────
  // Toda tarefa com data que aparece na Agenda aparece aqui também. Ordem: atrasadas →
  // próximas (por data) → concluídas (apagadas). Mantém os eventos de HOJE e os avisos.
  // Tarefas/eventos de HOJE (data civil de Brasília) — alimentam a coluna "Tarefas de hoje" (com hora).
  const hojeStr = dayBR(new Date())
  const tarefasHoje = tasks
    .filter(t => t.due_date === hojeStr && !t.done)
    .sort((a, b) => (a.due_time || '99:99').localeCompare(b.due_time || '99:99'))
  // Atrasadas: pendentes com data ANTERIOR a hoje. Protagonista do "Hoje" — dados JÁ carregados (sem query nova).
  const tarefasAtrasadas = tasks
    .filter(t => !t.done && !!t.due_date && t.due_date < hojeStr)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
  // Resumo do topo da aba Tarefas — próximos 7 dias e concluídas. Dados JÁ carregados (sem query nova).
  const semanaLimite = dayBR(new Date(Date.now() + 7 * 86400000))
  const tarefasSemana = tasks.filter(t => !t.done && !!t.due_date && t.due_date >= hojeStr && t.due_date <= semanaLimite)
  const tarefasConcluidas = tasks.filter(t => t.done)
  const eventosHoje = calEvents.filter(e => e.date === hojeStr).sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'))
  // Resumo do cabecalho executivo — contagem de dados JA carregados (sem query/metrica nova).
  const reunioesHoje = eventosHoje.filter(e => e.type === 'reuniao').length

  const TABS = [
    {
      id: 'activities' as Tab, label: 'Visão Geral',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
    {
      id: 'mapa' as Tab, label: 'Mapa',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="2.5" strokeWidth={1.75} /></svg>,
    },
    {
      id: 'tarefas' as Tab, label: 'Tarefas',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>,
    },
    {
      id: 'relatorio' as Tab, label: 'Relatório',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
      id: 'agent' as Tab, label: 'Agente',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>,
    },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 animate-fade-in font-body">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 suppressHydrationWarning className="font-display text-xl sm:text-2xl font-bold text-bento-text tracking-tight">
            {greeting ? `${greeting}, ${userName}` : userName}
          </h1>
          <p suppressHydrationWarning className="text-bento-muted mt-0.5 capitalize text-sm">{today}</p>
        </div>
      </div>

      {/* Tabs — FIXAS: as 5 cabem distribuídas (flex-1), SEM rolagem. overflow-x-hidden + touch-action:pan-y
          → arrastar o dedo na horizontal não move nada. Ficam pinadas no topo (só o conteúdo rola). */}
      <div className="flex border-b border-bento-border overflow-x-hidden touch-pan-y sticky top-0 z-20 bg-background">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} aria-pressed={isActive} onClick={() => setActiveTab(tab.id)}
              className={cn('relative flex-1 min-w-0 flex items-center justify-center gap-1.5 px-1 sm:px-3 py-3 text-[11px] sm:text-sm font-medium whitespace-nowrap transition-colors',
                isActive ? 'text-lime-fg' : 'text-bento-muted hover:text-bento-text')}>
              <span className="hidden sm:inline-flex shrink-0">{tab.icon}</span>
              {tab.label}
              {/* Realce: sublinhado lima renderizado SÓ na aba ativa (1 fonte de verdade: activeTab) —
                  impossível ficar preso em outro item. */}
              {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-lime" aria-hidden />}
            </button>
          )
        })}
      </div>

      {/* Canvas com grade técnica — todos os painéis vivem aqui dentro */}
      <div className="bento-canvas p-4 sm:p-5 space-y-4">

        {activeTab === 'activities' && (
          <>
            {/* ══ ALERTAS ══ só quando HÁ (pagamento em atraso, integração desligada, convite expirado, tarefas
                acumuladas). Dados reais do DashboardService. Sem alerta → nem aparece (o vazio é o Hall limpo). */}
            {dashboard.alerts.length > 0 && (
              <div className="rounded-frame border border-amber-800/40 bg-amber-900/10 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-amber-400">Alertas</p>
                </div>
                <ul className="space-y-1">
                  {dashboard.alerts.map((a, i) => (
                    <li key={i}>
                      {a.href ? (
                        <button type="button" onClick={() => router.push(a.href!)}
                          className="w-full text-left flex items-center gap-2 text-[13px] text-bento-text hover:text-amber-300 transition-colors min-h-[32px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="min-w-0 truncate">{a.message}</span>
                        </button>
                      ) : (
                        <span className="flex items-center gap-2 text-[13px] text-bento-text">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />{a.message}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ══ PRIORIDADES DE HOJE ══ o que exige ação agora: pendentes + hoje + reuniões (dados JÁ carregados)
                e leads aguardando contato (DashboardService). */}
            <SectionLabel>Prioridades de hoje</SectionLabel>
            <p className="text-sm leading-relaxed">
              {tarefasAtrasadas.length > 0 ? (
                <>
                  <strong className="font-semibold text-amber-400">{tarefasAtrasadas.length} {tarefasAtrasadas.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}</strong>
                  <span className="text-bento-muted">{' · '}{tarefasHoje.length} para hoje{' · '}{reunioesHoje} {reunioesHoje === 1 ? 'reunião' : 'reuniões'}</span>
                </>
              ) : (
                <span className="text-bento-muted">
                  Hoje: <strong className="font-semibold text-bento-text">{tarefasHoje.length} {tarefasHoje.length === 1 ? 'tarefa' : 'tarefas'}</strong>
                  {' · '}<strong className="font-semibold text-bento-text">{reunioesHoje} {reunioesHoje === 1 ? 'reunião' : 'reuniões'}</strong>
                  {tarefasHoje.length === 0 && reunioesHoje === 0 ? ' · agenda livre' : ''}
                </span>
              )}
            </p>

            {hallCfg.blocks.tarefas && (
              <CollapsibleSection title="Tarefas de hoje" icon={CalendarDays} defaultOpen>
                <Panel className="max-lg:p-3" headerClassName="max-lg:hidden" label="Tarefas de hoje">
                  <div className="space-y-2">
                    {/* Atrasadas primeiro — protagonista (âmbar). Cap 4; excedente abre a aba Tarefas. */}
                    {tarefasAtrasadas.slice(0, 4).map(t => (
                      <MuralTaskRow key={`late-${t.id}`} task={t} overdue onClick={() => router.push('/tarefas')} />
                    ))}
                    {tarefasAtrasadas.length > 4 && (
                      <button type="button" onClick={() => router.push('/tarefas')}
                        className="w-full text-left font-tech text-[11px] uppercase tracking-wide text-amber-400 hover:text-amber-300 transition-colors py-1">
                        +{tarefasAtrasadas.length - 4} pendentes — ver todas
                      </button>
                    )}
                    {/* Hoje: reuniões + tarefas do dia */}
                    {eventosHoje.length === 0 && tarefasHoje.length === 0
                      ? (tarefasAtrasadas.length === 0 && <p className="text-sm text-bento-muted py-6 text-center">Nada para hoje.</p>)
                      : <>
                          {eventosHoje.map(ev => <MuralAgendaRow key={`ev-${ev.id}`} ev={ev} onClick={() => setFocusEvent(ev)} />)}
                          {tarefasHoje.map(t => <MuralTaskRow key={`tk-${t.id}`} task={t} onClick={() => router.push('/tarefas')} />)}
                        </>}
                  </div>
                </Panel>
              </CollapsibleSection>
            )}

            {/* Leads aguardando contato — do DashboardService (follow-up vencido OU nunca contatado). Ação → Comercial. */}
            {dashboard.leadsAwaiting.count > 0 && (
              <button type="button" onClick={() => router.push('/comercial')}
                className="w-full text-left bento-fx p-3 flex items-center gap-3 hover:border-lime/40 transition-colors">
                <div className="w-8 h-8 rounded-bento bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
                  <UserPlus className="w-4 h-4 text-lime-fg" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-bento-text">
                    <strong className="font-semibold">{dashboard.leadsAwaiting.count}</strong>{' '}
                    {dashboard.leadsAwaiting.count === 1 ? 'lead aguardando contato' : 'leads aguardando contato'}
                  </p>
                  {dashboard.leadsAwaiting.sample.length > 0 && (
                    <p className="text-[12px] text-bento-muted truncate">{dashboard.leadsAwaiting.sample.map(s => s.name).join(' · ')}</p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-bento-dim shrink-0" />
              </button>
            )}

            {/* ══ INDICADORES ══ Comercial/Financeiro/Operação — do DashboardService (mesma fonte do /comercial),
                cartões ACIONÁVEIS que abrem o módulo. Substitui o pulso client-side: fonte única, sem recomputar. */}
            {dashboard.kpiGroups.map(group => (
              <div key={group.title} className="space-y-2">
                <SectionLabel>{group.title}</SectionLabel>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {group.kpis.map(k => (
                    <MetricCard key={k.label} title={k.label} value={k.value} size="sm" href={k.href} />
                  ))}
                </div>
              </div>
            ))}

            {/* ══ ATIVIDADES RECENTES ══ movimentações reais (realtime). Secundário — colapsa no mobile. */}
            {hallCfg.blocks.atividade && <SectionLabel>Atividades recentes</SectionLabel>}
            {hallCfg.blocks.atividade && (
              <CollapsibleSection title="Atividades Recentes" icon={ActivityIcon}>
                <Panel className="max-lg:p-3" headerClassName="max-lg:hidden" label="Atividades Recentes" action={<LiveDot />}>
                <div className="space-y-0 divide-y divide-bento-border/60">
                  {activities.length === 0 ? (
                    <p className="text-sm text-bento-muted py-6 text-center">Nenhuma atividade ainda.</p>
                  ) : activities.slice(0, activitiesExpanded ? activities.length : 3).map(a => {
                    const entityId = (a as { entity_id?: string | null }).entity_id
                    const clickable = a.type === 'lead' && !!entityId
                    return (
                    <div key={a.id}
                      onClick={clickable ? () => router.push(`/comercial?lead=${entityId}`) : undefined}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      className={cn('flex items-start gap-3 py-3 first:pt-0 last:pb-0',
                        clickable && 'cursor-pointer hover:bg-bento-bg/50 rounded-md -mx-1.5 px-1.5 transition-colors')}>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[a.type] ?? 'bg-slate-800/60 text-slate-400'}`}>
                        {ACTIVITY_ICONS[a.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-bento-text leading-snug">{a.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {a.user_name && <><p className="text-xs text-bento-muted">{a.user_name}</p><span className="text-bento-muted/50 text-xs">·</span></>}
                          <p className="font-tech text-xs text-bento-muted"><TimeAgo date={a.created_at} /></p>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
                {activities.length > 3 && (
                  <button type="button" onClick={() => setActivitiesExpanded(v => !v)}
                    className="font-tech text-[11px] uppercase tracking-wide text-lime-fg hover:text-lime transition-colors font-semibold mt-3 self-start">
                    {activitiesExpanded ? 'Ver menos' : `Ver mais (${activities.length - 3})`}
                  </button>
                )}
                <button type="button" onClick={() => setShowHistory(true)}
                  className="mt-3 pt-3 border-t border-bento-border/60 w-full text-center font-tech text-[11px] uppercase tracking-wide text-bento-muted hover:text-lime-fg transition-colors">
                  Ver histórico
                </button>
                </Panel>
              </CollapsibleSection>
            )}

            {/* ── Agenda (secundário) ── colapsada por padrão; completa (4 vistas + CRUD) ao expandir. */}
            {hallCfg.blocks.agenda && (
              <CollapsibleSection title="Agenda" icon={CalendarDays}>
                <Calendar userId={userId} events={calEvents} tasks={tasks} onEventsChange={setCalEvents} focusEvent={focusEvent} onFocusHandled={() => setFocusEvent(null)} />
              </CollapsibleSection>
            )}

            {/* ── Informações ── Notícias (secundário). */}
            {hallCfg.blocks.noticias && <SectionLabel>Informações</SectionLabel>}
            {hallCfg.blocks.noticias && (
              <CollapsibleSection title="Notícias do Setor" icon={Newspaper}>
                <NewsSection />
              </CollapsibleSection>
            )}
          </>
        )}

        {activeTab === 'mapa' && (
          <>
            {/* Contexto acima do mapa (Hall 2.0) — harmoniza com as seções da Visão Geral e evita que o mapa
                pareça isolado. NÃO compete com o header do próprio LeadMap (nível de seção, não de título). */}
            <SectionLabel>Distribuição geográfica</SectionLabel>
            <p className="text-sm text-bento-muted -mt-1">
              <strong className="font-semibold text-bento-text">{mapLeads.length}</strong> {mapLeads.length === 1 ? 'lead' : 'leads'}
              {' · '}<strong className="font-semibold text-bento-text">{mapClients.length}</strong> {mapClients.length === 1 ? 'cliente' : 'clientes'} da equipe, por estado (EUA).
            </p>
            {/* Mapa CHEIO — enche a LARGURA; a altura vem da proporção (height:auto do SVG). Sem altura
                fixa (não letterboxa). Mobile: padding mínimo no card pra o mapa usar quase a tela toda. */}
            {/* Título ÚNICO: o header do LeadMap ("Mapa de Leads" + relógios). O Panel fica SEM label p/ não duplicar. */}
            <Panel className="max-lg:p-1">
              <div className="w-full max-w-[960px] mx-auto">
                <ErrorBoundary>
                  <LeadMap markers={mapMarkers} showControls={false} showHeader={true} show={mapPrefs.show} resumo={mapPrefs.resumo} view={mapPrefs.view} tilt={mapPrefs.tilt} mode={mapPrefs.mode} theme={mapPrefs.theme} />
                </ErrorBoundary>
              </div>
            </Panel>
          </>
        )}

        {activeTab === 'tarefas' && (
          <div className="space-y-4">
            {/* Resumo do topo — protagonista: Atrasadas (âmbar). Contagens de dados JÁ carregados (sem query
                nova); a lista completa, filtros e "nova tarefa" seguem no TarefasClient abaixo, intacto. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard title="Pendentes" value={tarefasAtrasadas.length} size="sm" tone={tarefasAtrasadas.length > 0 ? 'warning' : 'muted'} />
              <MetricCard title="Hoje" value={tarefasHoje.length} size="sm" />
              <MetricCard title="Esta semana" value={tarefasSemana.length} size="sm" />
              <MetricCard title="Concluídas" value={tarefasConcluidas.length} size="sm" tone="muted" />
            </div>
            <TarefasClient tasks={tasks} setTasks={setTasks} deletedIds={deletedIds} linkOptions={linkOptions} currentUser={{ id: userId, name: userName }} />
          </div>
        )}

        {activeTab === 'relatorio' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
            <ErrorBoundary>
              <RelatorioComercial />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'agent' && (
          <div className="bento-fx h-[600px] overflow-hidden">
            <AgentChat userId={userId} userName={userName} />
          </div>
        )}

      </div>

      {showHistory && (
        <HistoryModal onClose={() => setShowHistory(false)} />
      )}
    </div>
  )
}
