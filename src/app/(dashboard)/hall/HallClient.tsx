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
import { CalendarDays, Activity as ActivityIcon, Newspaper, AlertTriangle } from 'lucide-react'
import type { Activity } from '@/types'
import type { Task, LinkOption } from '../tarefas/types'
import type { MapLead, MapClient } from '../comercial/mapTypes'
import type { DashboardData } from '@/server/services/DashboardService'
import { useTasksState } from '../tarefas/useTasksState'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { Calendar } from './Calendar'
import { type CalendarEvent } from './calendarShared'
import { dayBR } from '@/lib/date'
import dynamic from 'next/dynamic'
import { getHallSettings, DEFAULT_HALL_SETTINGS, HALL_SETTINGS_EVENT, type HallSettings } from '@/lib/hallSettings'
import { useMapPrefs } from '@/lib/mapPrefs'
import { toLeadMarkers } from '@/lib/leadMarkers'
import { ACTIVITY_ICONS, ACTIVITY_COLORS, computeGreeting, MuralAgendaRow, MuralTaskRow, HistoryModal } from './hall-mural'
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
  activeTeamId: string | null
  dashboard: DashboardData
}


// ─── Main HallClient ──────────────────────────────────────────────────────────

// Divisor de secao discreto: rotulo pequeno + fio fino (sem caixa/borda pesada). Usado na Visao Geral.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-tech text-caption uppercase tracking-label text-bento-muted shrink-0">{children}</span>
      <span className="h-px flex-1 bg-bento-border/50" aria-hidden />
    </div>
  )
}

export function HallClient({ initialActivities, initialTasks, linkOptions, userName, userId, activeTeamId, dashboard }: Props) {
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
    // Agenda PESSOAL: eventos do usuário logado na equipe ativa (PERSONAL-WORK-001). Reuniões comerciais do
    // lead vivem em `meetings` (outra entidade) — não entram aqui. Novo membro entra com agenda vazia.
    let calQuery = supabase.from('calendar_events').select('*').eq('user_id', userId)
    if (activeTeamId) calQuery = calQuery.eq('team_id', activeTeamId)
    calQuery.order('date').then(({ data }) => { if (data) setCalEvents(data as CalendarEvent[]) })

    const dataChannel = supabase.channel('hall-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' },
        p => setActivities(prev => [p.new as Activity, ...prev.slice(0, 19)]))
      .subscribe()
    return () => { dataChannel.unsubscribe().then(() => supabase.removeChannel(dataChannel)) }
  }, [userId, activeTeamId])

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
  const inicioSemana = useMemo(() => {
    const date = new Date()
    const day = date.getDay()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
    return date.toISOString()
  }, [])
  const tarefasConcluidasSemana = tasks.filter(t => t.done && (t.completed_at ?? t.updated_at) >= inicioSemana)
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-3 animate-fade-in font-body">

      {/* ══ Z1 · CONTEXTO — hero executivo: quem/quando + resumo do dia + alertas (chips). SÓ reorganiza dados
          JÁ existentes (saudação, data, contadores de tarefas/reuniões/leads, alerts do DashboardService).
          Sem query/estado novo; alertas viram chips clicáveis (deixam de ser painel), sem popover. */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap">
          <h1 suppressHydrationWarning className="font-display text-xl sm:text-2xl font-bold text-bento-text tracking-tight">
            {greeting ? `${greeting}, ${userName}` : userName}
          </h1>
          <p suppressHydrationWarning className="text-bento-muted capitalize text-sm">{today}</p>
        </div>
        <p className="text-sm leading-relaxed">
          {tarefasAtrasadas.length > 0 ? (
            <>
              <strong className="font-semibold text-amber-400">{tarefasAtrasadas.length} {tarefasAtrasadas.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}</strong>
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
        {dashboard.alerts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {dashboard.alerts.map((a, i) => (
              a.href ? (
                <button key={i} type="button" onClick={() => router.push(a.href!)}
                  className="inline-flex items-center gap-1.5 max-w-full rounded-full border border-amber-800/40 bg-amber-900/10 px-2.5 py-1 text-note text-amber-300 hover:border-amber-500/50 transition-colors">
                  <AlertTriangle className="w-3 h-3 shrink-0" /><span className="truncate">{a.message}</span>
                </button>
              ) : (
                <span key={i} className="inline-flex items-center gap-1.5 max-w-full rounded-full border border-amber-800/40 bg-amber-900/10 px-2.5 py-1 text-note text-amber-300">
                  <AlertTriangle className="w-3 h-3 shrink-0" /><span className="truncate">{a.message}</span>
                </span>
              )
            ))}
          </div>
        )}
      </div>

      {/* Tabs — FIXAS: as 5 cabem distribuídas (flex-1), SEM rolagem. O gutter mobile evita que
          overflow de texto do primeiro item seja cortado pela borda do container. */}
      <div className="flex border-b border-bento-border overflow-x-hidden touch-pan-y sticky top-0 z-20 bg-background max-sm:-mx-3 max-sm:px-3">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} aria-pressed={isActive} onClick={() => setActiveTab(tab.id)}
              className={cn('relative flex-1 min-w-0 flex items-center justify-center gap-1.5 px-1 sm:px-3 py-3 text-caption sm:text-sm font-medium whitespace-nowrap transition-colors',
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
      <div className="bento-canvas p-4 sm:p-5 space-y-3">

        {activeTab === 'activities' && (
          <div className="flex flex-col gap-3">
            {/* Alertas + resumo do dia ("Prioridades") migraram para o HERO (Z1) acima — contexto primeiro,
                sem painel dedicado. Aqui o canvas começa direto no TRABALHO (o que fazer). */}
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
                        className="w-full text-left font-tech text-caption uppercase tracking-label text-amber-400 hover:text-amber-300 transition-colors py-1">
                        +{tarefasAtrasadas.length - 4} atrasadas — ver todas
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

            {/* ══ INDICADORES ══ Comercial/Financeiro/Operação — do DashboardService (mesma fonte do /comercial),
                cartões ACIONÁVEIS que abrem o módulo. Substitui o pulso client-side: fonte única, sem recomputar. */}
            {dashboard.kpiGroups.map((group, gi) => {
              // 1º grupo (Receita, financeiro) = tier de COMANDO: cards maiores (md) → destaca Receita/MRR/ARR.
              // Demais grupos (Comercial, Operação) = tier operacional, compacto (sm). Só apresentação — os
              // grupos e os números vêm intactos de dashboard.kpiGroups (índice, sem detectar rótulo).
              const primary = gi === 0
              return (
                <div key={group.title} className="flex flex-col gap-2">
                  <SectionLabel>{group.title}</SectionLabel>
                  <div className={cn('grid gap-2.5', primary ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4')}>
                    {group.kpis.map(k => (
                      <MetricCard key={k.label} title={k.label} value={k.value} size={primary ? 'md' : 'sm'} href={k.href} />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* ══ SPLIT DESKTOP 8/4 (HALL-PREMIUM-004) — principal (Atividades + Agenda) + rail (Receita +
                Notícias). Mobile empilha (lg:* inerte; acordeões/agenda/notícias intactos). O gap sobrevive ao
                lg:contents do CollapsibleSection (space-y não sobreviveria); items-start = rail não estica. */}
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-start">
              {/* ── Coluna principal 8/12 — pulso / trabalho ── */}
              <div className="lg:col-span-8 flex flex-col gap-3 min-w-0">
                {/* ══ ATIVIDADES RECENTES ══ movimentações reais (realtime). */}
                {hallCfg.blocks.atividade && (
                  <CollapsibleSection title="Atividades Recentes" icon={ActivityIcon}>
                    <Panel className="max-lg:p-3 lg:pb-4" headerClassName="max-lg:hidden" label="Atividades Recentes" action={<LiveDot />}>
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
                          className={cn('flex items-start gap-3 py-2 first:pt-0 last:pb-0',
                            clickable && 'cursor-pointer hover:bg-bento-bg/50 rounded-btn -mx-1.5 px-1.5 transition-colors')}>
                          <div className={`w-7 h-7 rounded-bento flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[a.type] ?? 'bg-bento-panel text-bento-muted'}`}>
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
                        className="font-tech text-caption uppercase tracking-label text-lime-fg hover:text-lime transition-colors font-semibold mt-2.5 self-start">
                        {activitiesExpanded ? 'Ver menos' : `Ver mais (${activities.length - 3})`}
                      </button>
                    )}
                    <button type="button" onClick={() => setShowHistory(true)}
                      className="mt-2.5 pt-2.5 border-t border-bento-border/60 w-full text-center font-tech text-caption uppercase tracking-label text-bento-muted hover:text-lime-fg transition-colors">
                      Ver histórico
                    </button>
                    </Panel>
                  </CollapsibleSection>
                )}
                {/* ── Agenda ── colapsada por padrão; completa (4 vistas + CRUD) ao expandir. */}
                {hallCfg.blocks.agenda && (
                  <CollapsibleSection title="Agenda" icon={CalendarDays}>
                    <Calendar userId={userId} events={calEvents} tasks={tasks} onEventsChange={setCalEvents} focusEvent={focusEvent} onFocusHandled={() => setFocusEvent(null)} />
                  </CollapsibleSection>
                )}
              </div>
              {/* ── Rail lateral 4/12 — consulta / apoio ── */}
              <div className="lg:col-span-4 flex flex-col gap-3 min-w-0">
                {/* ══ RECEITA POR VENDEDOR / PLANO ══ recebida no mês — mesma FONTE ÚNICA (ExecutiveMetricsService). */}
                {(dashboard.receitaPorVendedor.length > 0 || dashboard.receitaPorPlano.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                    {dashboard.receitaPorVendedor.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <SectionLabel>Receita por vendedor</SectionLabel>
                        <Panel className="max-lg:p-3">
                          <div className="space-y-1.5">
                            {dashboard.receitaPorVendedor.map(r => (
                              <div key={r.label} className="flex items-center justify-between gap-2 text-note">
                                <span className="text-bento-text truncate">{r.label} <span className="text-bento-dim">· {r.count} cliente(s)</span></span>
                                <span className="font-tech text-bento-text tabular-nums shrink-0">US$ {Math.round(r.value).toLocaleString('en-US')}</span>
                              </div>
                            ))}
                          </div>
                        </Panel>
                      </div>
                    )}
                    {dashboard.receitaPorPlano.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <SectionLabel>Receita por plano</SectionLabel>
                        <Panel className="max-lg:p-3">
                          <div className="space-y-1.5">
                            {dashboard.receitaPorPlano.map(r => (
                              <div key={r.label} className="flex items-center justify-between gap-2 text-note">
                                <span className="text-bento-text truncate">{r.label} <span className="text-bento-dim">· {r.count} cliente(s)</span></span>
                                <span className="font-tech text-bento-text tabular-nums shrink-0">US$ {Math.round(r.value).toLocaleString('en-US')}</span>
                              </div>
                            ))}
                          </div>
                        </Panel>
                      </div>
                    )}
                  </div>
                )}
                {/* ── Informações ── Notícias (secundário). */}
                {hallCfg.blocks.noticias && (
                  <div className="flex flex-col gap-2">
                  <SectionLabel>Informações</SectionLabel>
                  <CollapsibleSection title="Notícias do Setor" icon={Newspaper}>
                    <NewsSection />
                  </CollapsibleSection>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mapa' && (
          <>
            {/* Contexto acima do mapa (Hall 2.0) — harmoniza com as seções da Visão Geral e evita que o mapa
                pareça isolado. NÃO compete com o header do próprio LeadMap (nível de seção, não de título). */}
            <div className="flex flex-col gap-2">
            <SectionLabel>Distribuição geográfica</SectionLabel>
            <p className="text-sm text-bento-muted">
              <strong className="font-semibold text-bento-text">{mapLeads.length}</strong> {mapLeads.length === 1 ? 'lead' : 'leads'}
              {' · '}<strong className="font-semibold text-bento-text">{mapClients.length}</strong> {mapClients.length === 1 ? 'cliente' : 'clientes'} da equipe, por estado (EUA).
            </p>
            </div>
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
          <div className="space-y-3">
            {/* Resumo do topo — protagonista: Atrasadas (âmbar). Contagens de dados JÁ carregados (sem query
                nova); a lista completa, filtros e "nova tarefa" seguem no TarefasClient abaixo, intacto. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard title="Atrasadas" value={tarefasAtrasadas.length} size="sm" tone={tarefasAtrasadas.length > 0 ? 'warning' : 'muted'} />
              <MetricCard title="Hoje" value={tarefasHoje.length} size="sm" />
              <MetricCard title="Esta semana" value={tarefasSemana.length} size="sm" />
              <MetricCard title="Feitas esta semana" value={tarefasConcluidasSemana.length} size="sm" tone="muted" />
            </div>
            <TarefasClient tasks={tasks} setTasks={setTasks} deletedIds={deletedIds} linkOptions={linkOptions} currentUser={{ id: userId, name: userName }} />
          </div>
        )}

        {activeTab === 'relatorio' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
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
