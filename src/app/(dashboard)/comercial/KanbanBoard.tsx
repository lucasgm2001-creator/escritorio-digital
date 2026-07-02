'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { DraggableTabs } from '@/components/DraggableTabs'
import { useCanManageTeam } from '@/components/auth/RoleProvider'
import { KanbanColumn } from './KanbanColumn'
import { PhaseSelectorMobile } from './PhaseSelectorMobile'
import { LeadCard } from './LeadCard'
import dynamic from 'next/dynamic'
// Fallback discreto enquanto o chunk da aba carrega (DS-005).
function TabLoading() { return <div className="h-full flex items-center justify-center text-sm text-bento-muted">Carregando…</div> }
// Abas não-default e modais: carregam sob demanda (client-only). Não pintam no 1º paint (aba padrão =
// 'funil') → saem do bundle inicial da rota SEM mudar a UI. Modais abrem via Portal (sem fallback, igual LeadDiary).
const LeadDiary     = dynamic(() => import('./LeadDiary').then(m => ({ default: m.LeadDiary })),             { ssr: false })
const LeadModal     = dynamic(() => import('./LeadModal').then(m => ({ default: m.LeadModal })),             { ssr: false })
const WonPlanModal  = dynamic(() => import('./WonPlanModal').then(m => ({ default: m.WonPlanModal })),       { ssr: false })
const MetricasTab   = dynamic(() => import('./tabs/MetricasTab').then(m => ({ default: m.MetricasTab })),     { ssr: false, loading: TabLoading })
const ContatosTab   = dynamic(() => import('./tabs/ContatosTab').then(m => ({ default: m.ContatosTab })),     { ssr: false, loading: TabLoading })
const VendedoresTab = dynamic(() => import('./tabs/VendedoresTab').then(m => ({ default: m.VendedoresTab })), { ssr: false, loading: TabLoading })
import { moveLead } from './leadActions'
import { markMilestones } from '@/lib/leadMilestones'
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows'
import { usdCompact as fmtUSDc } from '@/lib/format'
import type { Client as ClienteRow } from '../clientes/types'
import type { Lead, LeadStatus } from './types'
import { columnsFromStages, wonSlug, type FunnelStage } from '@/lib/funnelStages'
import { PeriodChips } from './PeriodChips'
import { rangeFor, inPeriodByActivity, type Range } from '@/lib/period'
import { funnelConversionLabel } from '@/lib/funnelMetrics'
export type { LeadStatus, Lead, ColumnConfig } from './types'

type Tab = 'funil' | 'contatos' | 'metricas' | 'vendedores'

interface CurrentUser { id: string; name: string }

// ── Barra de resumo do funil (rodapé) ──────────────────────────────────────────
const isTerminal = (s: LeadStatus) => s === 'fechado' || s === 'perdido' || s === 'lixeira'

// `leads` = lista do período selecionado (Pipeline/Ativos/Fechados/Perdidos respeitam o chip de período).
// `allLeads` = base CHEIA (todos os leads, ignora o período) — usada SÓ na Conversão GERAL p/ ela bater
// SEMPRE com o Mapa (Hall), que também usa a base cheia. Mesma definição/util nos dois (fechados ÷ não-Lixeira).
function FunnelSummary({ leads, allLeads }: { leads: Lead[]; allLeads: Lead[] }) {
  const ativos = leads.filter(l => !isTerminal(l.status))
  const fechados = leads.filter(l => l.status === 'fechado').length
  const perdidos = leads.filter(l => l.status === 'perdido').length
  const pipeline = ativos.reduce((s, l) => s + (l.value || 0), 0)
  // Conversão GERAL — base cheia (não a do período) → MESMO número do Mapa (Hall) em qualquer período.
  const conv = funnelConversionLabel(allLeads)
  return (
    <div className="flex-none border-t border-bento-border bg-bento-panel px-4 sm:px-6 py-2.5 flex items-center gap-x-6 gap-y-1 flex-wrap">
      <SummaryStat label="Pipeline" value={fmtUSDc(pipeline)} />
      <SummaryStat label="Conversão" value={`${conv}%`} />
      <SummaryStat label="Ativos" value={String(ativos.length)} />
      <SummaryStat label="Fechados" value={String(fechados)} accent="text-green-500" />
      <SummaryStat label="Perdidos" value={String(perdidos)} accent="text-red-400" />
      <div className="ml-auto flex items-center gap-3 font-tech text-[10px] text-bento-muted">
        <SummaryLegend cls="bg-lime" t="Quente" />
        <SummaryLegend cls="bg-amber-500" t="Atenção" />
        <SummaryLegend cls="bg-red-500" t="Esfriando" />
      </div>
    </div>
  )
}
function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">{label}</span>
      <span className={cn('font-display text-sm font-bold tabular-nums', accent ?? 'text-bento-text')}>{value}</span>
    </div>
  )
}
function SummaryLegend({ cls, t }: { cls: string; t: string }) {
  return <span className="flex items-center gap-1"><span className={cn('w-2 h-2 rounded-full', cls)} />{t}</span>
}

export function KanbanBoard({ initialLeads, initialStages, initialClients, currentUser }: { initialLeads: Lead[], initialStages: FunnelStage[], initialClients: ClienteRow[], currentUser: CurrentUser }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  // Reflete dados frescos do servidor após router.refresh() (revalidação ao focar a aba).
  useEffect(() => { setLeads(initialLeads) }, [initialLeads])
  // Tempo real: criar/mover/excluir lead reflete ao vivo (merge por id; reconcilia o eco).
  useRealtimeRows<Lead>('leads', setLeads)
  // Clientes em estado (p/ o Mapa e a edição via Contatos refletirem na hora). Sincroniza com o
  // servidor e ouve realtime (edição na aba Clientes também reflete aqui).
  const [clients, setClients] = useState<ClienteRow[]>(initialClients)
  useEffect(() => { setClients(initialClients) }, [initialClients])
  useRealtimeRows<ClienteRow>('clients', setClients)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [pendingWon, setPendingWon] = useState<Lead | null>(null)   // lead aguardando escolha de plano (fechamento)
  const [tab, setTab] = useState<Tab>('funil')
  // Filtro de período do FUNIL (em memória; reload volta pra "Tudo"). Métricas tem o seu próprio.
  const [funnelRange, setFunnelRange] = useState<Range>(() => rangeFor('tudo'))
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  // Desktop = colunas com drag; mobile = acordeão de fases. Renderiza só UM
  // (evita ids duplicados no dnd-kit). Default desktop p/ o SSR; ajusta no mount.
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const supabase = createClient()
  // Fases ao vivo: vêm de initialStages — a page do Comercial é dinâmica (Supabase/cookies), então
  // initialStages já chega fresco; um router.refresh re-hidrata via o efeito abaixo. SÓ VISUAL — o
  // won-flow/comissão lê initialStages (dinheiro intocado). (Removida a re-leitura redundante no mount.)
  const [liveStages, setLiveStages] = useState<FunnelStage[]>(initialStages)
  useEffect(() => { setLiveStages(initialStages) }, [initialStages])
  const cols = useMemo(() => columnsFromStages(liveStages), [liveStages])
  // Funil montado DINAMICAMENTE: faixas = valores DISTINTOS de `grupo` (ordem da menor posicao, pois
  // cols já vem ordenado por posicao); grupo null → "Sem grupo". Nada hardcoded → grupo novo ganha faixa.
  const funnelGroups = useMemo(() => {
    const map = new Map<string, typeof cols>()
    for (const c of cols) {
      const g = (c.grupo && c.grupo.trim()) || 'Sem grupo'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(c)
    }
    return Array.from(map.entries()).map(([name, columns]) => ({ name, columns }))
  }, [cols])
  const wonStatus = useMemo(() => wonSlug(initialStages) as LeadStatus, [initialStages])
  // Alvos de "Mover para" no card = fases REAIS (renomeadas/novas refletem), não ALL_COLUMNS fixo.
  const moveTargets = useMemo(() => cols.map(c => ({ key: c.key, label: c.label })), [cols])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Papel na equipe: só owner/admin veem a aba "Equipe e Comissões" (config de remuneração) — COMMISSION-003.
  const canManageTeam = useCanManageTeam()

  // Deep-link vindo do Hall: /comercial?lead=<id> abre o lead no funil.
  const tabHandled = useRef(false)
  const leadHandled = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // tab: aplica UMA vez (no mount), independente dos leads.
    if (!tabHandled.current) {
      tabHandled.current = true
      const tabParam = params.get('tab')
      const allowedTabs = canManageTeam ? ['funil', 'contatos', 'metricas', 'vendedores'] : ['funil', 'contatos', 'metricas']
      if (tabParam && allowedTabs.includes(tabParam)) setTab(tabParam as Tab)
    }
    // lead: precisa da LISTA carregada. M16: depende de `leads` → abre assim que o id existir (uma vez só).
    if (!leadHandled.current) {
      const leadId = params.get('lead')
      if (!leadId) { leadHandled.current = true }
      else {
        const lead = leads.find(l => l.id === leadId)
        if (lead) { leadHandled.current = true; setTab('funil'); setSelectedLead(lead) }
        // não achou ainda → mantém leadHandled=false e re-tenta quando `leads` mudar
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'funil',        label: 'Funil' },
    { key: 'contatos',     label: 'Contatos' },
    { key: 'metricas',     label: 'Métricas' },
    // "Equipe e Comissões" (remuneração) só p/ owner/admin (COMMISSION-003).
    ...(canManageTeam ? [{ key: 'vendedores' as Tab, label: 'Equipe e Comissões' }] : []),
  ]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )
  // Mobile NÃO usa drag (rolar não pode agarrar card): mover é pelo seletor de fase no LeadDiary.

  // Funil filtrado pelo período (última atividade = updated_at; senão created_at). "Tudo" mostra tudo.
  // Contadores das colunas, totais R$/US$ e o resumo do funil derivam daqui → recalculam sozinhos.
  const filteredLeads = useMemo(
    () => leads.filter(l => inPeriodByActivity(funnelRange, l.updated_at, l.created_at)),
    [leads, funnelRange],
  )

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)

  // Executa o movimento de fato: otimista → persiste via moveLead (que dispara o won-flow/comissão
  // ao ir pra is_won) → rollback+toast se falhar. planoId só é usado no fechamento.
  const doMove = useCallback(async (lead: Lead, newStatus: LeadStatus, planoId: string | null = null): Promise<boolean> => {
    if (lead.status === newStatus) return true
    const prevStatus = lead.status
    const prevStage = lead.stage_changed_at
    const nowIso = new Date().toISOString()
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus, stage_changed_at: nowIso } : l))   // otimista
    const res = await moveLead(supabase, lead, newStatus, currentUser.name, initialStages, planoId, currentUser.id)
    if (!res.ok) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: prevStatus, stage_changed_at: prevStage } : l))   // rollback
      showToast(`Não foi possível mover o lead: ${res.error}`, 'error')
      return false
    }
    for (const n of res.notes) showToast(n.message, n.type)
    return true
  }, [supabase, currentUser.name, currentUser.id, initialStages])

  // Choke point de TODO movimento (drag, tap, diário). Ao FECHAR (is_won) pelo funil, intercepta
  // e pede o PLANO antes de criar a venda (Fase 2A). Demais fases movem direto. (Agente = caminho à parte.)
  const moveLeadToStatus = useCallback(async (lead: Lead, newStatus: LeadStatus): Promise<boolean> => {
    if (lead.status === newStatus) return true
    if (newStatus === wonStatus && lead.status !== wonStatus) {
      setPendingWon(lead)   // abre o modal de plano; o move real acontece no confirmWon
      return false
    }
    return doMove(lead, newStatus)
  }, [wonStatus, doMove])

  // Confirma o fechamento com o plano escolhido → cria a venda pelo % do plano e fecha o diário.
  const confirmWon = useCallback(async (planoId: string | null) => {
    const lead = pendingWon
    setPendingWon(null)
    if (!lead) return
    await doMove(lead, wonStatus, planoId)
    setSelectedLead(null)
  }, [pendingWon, wonStatus, doMove])

  // Registra um contato com o lead em lead_interactions (fundação do relatório de
  // engajamento). atendeu/mensagem = engajou; nao_atendeu NÃO conta como engajado.
  const logInteraction = useCallback(async (lead: Lead, type: string) => {
    const delta = ({ atendeu: 80, mensagem: 20, nao_atendeu: -30 } as Record<string, number>)[type] ?? 0
    const nowIso = new Date().toISOString()
    const { error } = await supabase.from('lead_interactions').insert({
      lead_id: lead.id, type, score_delta: delta,
      created_by: currentUser.id, created_by_name: currentUser.name,
    })
    if (error) { showToast(`Não foi possível registrar o contato: ${error.message}`, 'error'); return }
    // Marco do relatório: contato real = interagiu (nao_atendeu NÃO conta). Idempotente.
    if (type === 'atendeu' || type === 'mensagem') await markMilestones(supabase, lead.id, ['interagiu'])
    const newScore = Math.max(0, Math.min(1000, (lead.score ?? 0) + delta))
    await supabase.from('leads').update({ score: newScore, last_contact_at: nowIso }).eq('id', lead.id)
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, score: newScore, last_contact_at: nowIso } : l))
    showToast(`Contato registrado: ${type === 'atendeu' ? 'Atendeu' : type === 'mensagem' ? 'Mensagem' : 'Não atendeu'}.`)
  }, [supabase, currentUser])

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const leadId = active.id as string
    const overId = over.id as string
    // "over" pode ser a coluna (droppable) ou outro card (soltou sobre um card).
    const newStatus = cols.find(c => c.key === overId)?.key
      ?? leads.find(l => l.id === overId)?.status
    if (!newStatus) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    await moveLeadToStatus(lead, newStatus)
  }, [leads, cols, moveLeadToStatus])

  const handleLeadCreated = (lead: Lead) => setLeads(prev => [lead, ...prev])
  const handleLeadUpdated = (lead: Lead) => setLeads(prev => prev.map(l => l.id === lead.id ? lead : l))

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  return (
    <div className="flex flex-col h-full bg-bento-bg relative font-body">
      {/* Header */}
      <div className="flex-none bg-bento-bg border-b border-bento-border">
        <div className="flex items-center justify-between gap-2 flex-wrap px-4 sm:px-6 pt-4 pb-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="font-display font-bold text-bento-text text-lg tracking-tight">Comercial</h1>
            <span className="font-tech text-xs text-bento-muted font-medium tabular-nums">{(tab === 'funil' ? filteredLeads : leads).length} leads</span>
          </div>

          <button
            onClick={() => setNewLeadOpen(true)}
            className="bento-btn flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold w-full sm:w-auto"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Lead
          </button>
        </div>

        {/* Tabs - Draggable */}
        <div className="px-6">
          <DraggableTabs tabs={TABS} activeTab={tab} onTabChange={(key) => setTab(key as Tab)} sectionKey="comercial" />
        </div>

        {/* Filtro de período do Funil (só nesta aba). Padrão "Tudo". Mobile: chips rolam, sem overflow. */}
        {tab === 'funil' && (
          <div className="px-4 sm:px-6 pt-2 pb-3 flex items-center gap-3 flex-wrap">
            <PeriodChips range={funnelRange} onChange={setFunnelRange} />
            <span className="font-tech text-[11px] text-bento-muted whitespace-nowrap hidden sm:inline">
              Período: <span className="text-bento-text font-semibold">{funnelRange.label}</span>
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Funil — DESKTOP: tiers horizontais (esq→dir) com caixas colapsáveis */}
        {tab === 'funil' && isDesktop && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-full flex flex-col bg-bento-bg">
              {/* Rola na VERTICAL (alcança as fases empilhadas quando uma expande) e na HORIZONTAL
                  (colunas). flex-1 já limita a altura (dentro do flex-col h-full) → o overflow-y rola aqui. */}
              <div className="flex-1 overflow-x-auto overflow-y-auto overscroll-y-contain p-4 sm:p-5">
                <div className="flex items-stretch gap-4 min-w-max h-full">
                  {funnelGroups.map(g => (
                    <div key={g.name} className="flex flex-col gap-2 self-start">
                      {/* Faixa/cabeçalho do grupo (nome atual) */}
                      <div className="px-2.5 py-1 rounded-md bg-bento-panel border border-bento-border">
                        <span className="font-tech text-[10px] uppercase tracking-[0.14em] text-bento-dim truncate">{g.name}</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {g.columns.map(col => (
                          <KanbanColumn
                            key={col.key}
                            column={col}
                            leads={filteredLeads.filter(l => l.status === col.key)}
                            moveTargets={moveTargets}
                            onMove={moveLeadToStatus}
                            onOpenDiary={setSelectedLead}
                            onLog={logInteraction}
                            userId={currentUser.id}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <FunnelSummary leads={filteredLeads} allLeads={leads} />
            </div>
            <DragOverlay>
              {activeLead ? <LeadCard lead={activeLead} isDragging /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Funil — MOBILE: seletor de fase (dropdown) + cards da fase escolhida. SEM drag: tocar no
            card abre o LeadDiary, que move pela MESMA função (e dispara a comissão igual ao desktop). */}
        {tab === 'funil' && !isDesktop && (
          /* Rola ATÉ O FIM: scroll vertical explícito + folga inferior (clear da BottomNav/safe-area). */
          <div className="h-full overflow-y-auto overscroll-contain p-3 pb-[max(2rem,env(safe-area-inset-bottom))] bg-bento-bg">
            <PhaseSelectorMobile columns={cols} leads={filteredLeads} onOpenDiary={setSelectedLead} />
          </div>
        )}

        {tab === 'contatos'     && <ContatosTab leads={leads} clients={clients} onOpenLead={setSelectedLead} onClientUpdated={c => setClients(prev => prev.map(x => x.id === c.id ? c : x))} />}
        {tab === 'metricas'     && <MetricasTab leads={leads} />}
        {tab === 'vendedores'   && canManageTeam && <VendedoresTab />}
      </div>

      {/* Modals */}
      {newLeadOpen && (
        <LeadModal
          onClose={() => setNewLeadOpen(false)}
          onCreated={handleLeadCreated}
          currentUser={currentUser}
          stages={liveStages}
          clients={clients}
        />
      )}

      {selectedLead && (
        <LeadDiary
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={handleLeadUpdated}
          onMoveStage={(newStatus) => {
            const fresh = leads.find(l => l.id === selectedLead.id) ?? selectedLead
            return moveLeadToStatus(fresh, newStatus)
          }}
          onDeleted={(id) => { setLeads(prev => prev.filter(l => l.id !== id)); setSelectedLead(null) }}
          currentUser={currentUser}
          stages={initialStages}
        />
      )}

      {/* Fechamento (Fase 2A): escolhe o plano → comissão pelo % do plano. Cancelar não fecha a venda. */}
      {pendingWon && (
        <WonPlanModal
          leadName={pendingWon.name}
          onConfirm={confirmWon}
          onCancel={() => setPendingWon(null)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-card-hover animate-slide-up ${
          toast.type === 'success'
            ? 'bg-emerald-900/90 border-emerald-700/60 text-emerald-200'
            : 'bg-red-900/90 border-red-700/60 text-red-200'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
