'use client'

// Módulo de Comissão — Tela (perfil do vendedor, sub-tab "Comissão").
// Bloco 1: Resumo do mês + Configuração (salário c/ vigência, cotação global).
// Bloco 2: Lançamentos — venda (deals), semanas recebidas (weekly_payments),
//          reunião (meetings), status/rescisão e pendências na tela.
// Usa SÓ as tabelas/funções da migration 017. Moeda real = USD; BRL é exibição.
// Cada lançamento congela a cotação vigente no momento.

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Lock, Unlock, Wallet, DollarSign, RefreshCw,
  Receipt, Handshake, Download, Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSave } from '@/lib/useSave'
import { useToast } from '@/components/ui/toast'
import {
  updateFxConfigAction, addSalaryAction, createDealAction, updateDealStatusAction, deleteDealAction,
  updateDealAction, payWeekAction, deleteWeekAction, updateWeekDateAction, registerMeetingAction,
  deleteMeetingAction, updateMeetingAction,
  updateRenewalBonusAction,
  updateUpgradeCommissionAction,
} from '../compensation-write-actions'
import { cn } from '@/lib/utils'
import { monthlySummary, resolveRate, dealTotal, pendingCommission } from '@/lib/commission/calc'
import { meetingCommissionCounts } from '@/lib/commission/constants'
import { payWeekMessage } from '@/lib/commission/actions'
import type { SalaryPeriod, WeeklyPayment, FxConfig, DealStatus } from '@/lib/commission/types'
import { usd, brl } from '@/lib/format'
import { ClientPaymentsPanel } from '@/components/client/ClientPaymentsPanel'
import {
  inputCls, pad2, monthName, fmtMonthYear, fmtDayMonth, fmtDayMonthYear, FX_FALLBACK, fxSourceMeta,
  CLIENT_STATUS, todayISO, toDealUI, toWeek, toMeeting, type DealUI, type MeetingUI,
} from './commission-shared'
import { DealCard, MeetingRow, Collapsible } from './CommissionCards'

export function CommissionSection({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
  const save = useSave()
  const { toast } = useToast()
  const supabase = createClient()

  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }))

  const [loading, setLoading] = useState(true)
  const [salaries, setSalaries] = useState<SalaryPeriod[]>([])
  const [meetings, setMeetings] = useState<MeetingUI[]>([])
  const [weeks, setWeeks] = useState<WeeklyPayment[]>([])
  const [deals, setDeals] = useState<DealUI[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([])

  // Cotação (global)
  const [fxManual, setFxManual] = useState<number | null>(null)
  const [fxTravada, setFxTravada] = useState(false)
  const [fxManualInput, setFxManualInput] = useState('')
  const [fxTravadaInput, setFxTravadaInput] = useState(false)
  const [savingFx, setSavingFx] = useState(false)
  const [fxError, setFxError] = useState('')
  const [fxReferencia, setFxReferencia] = useState<number | null>(null)
  const [fxAuto, setFxAuto] = useState<{ referencia: number; effective: number; source: string } | null>(null)
  const [fxRefreshing, setFxRefreshing] = useState(false)

  // Mês em foco
  const now = new Date()
  const [refDate, setRefDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const prevMonth = () => setRefDate(r => r.month === 1 ? { year: r.year - 1, month: 12 } : { year: r.year, month: r.month - 1 })
  const nextMonth = () => setRefDate(r => r.month === 12 ? { year: r.year + 1, month: 1 } : { year: r.year, month: r.month + 1 })

  // Form salário
  const [salValor, setSalValor] = useState('')
  const [salMonth, setSalMonth] = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`)
  const [savingSal, setSavingSal] = useState(false)
  const [salError, setSalError] = useState('')
  const [renewalEnabled, setRenewalEnabled] = useState(false)
  const [savingRenewal, setSavingRenewal] = useState(false)
  const [upgradeEnabled, setUpgradeEnabled] = useState(false)
  const [savingUpgrade, setSavingUpgrade] = useState(false)

  // Form venda
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [dealForm, setDealForm] = useState({ client: '', valorTotal: '100', semanas: '4', dataFechamento: todayISO() })
  const [savingDeal, setSavingDeal] = useState(false)
  const [dealError, setDealError] = useState('')
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)

  // Form reunião
  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ metOn: todayISO(), valor: '15', client: '', note: '' })
  const [savingMeeting, setSavingMeeting] = useState(false)
  const [meetingError, setMeetingError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [salRes, mtgRes, dealRes, fxRes, cliRes, leadRes, renewalRes] = await Promise.all([
      supabase.from('seller_salaries').select('seller_id, valor_usd, effective_from').eq('seller_id', sellerId).order('effective_from', { ascending: false }),
      supabase.from('meetings').select('id, seller_id, met_on, valor_usd, cotacao_usd_brl, client_name').eq('seller_id', sellerId).order('met_on', { ascending: false }),
      supabase.from('deals').select('id, seller_id, client_name, valor_total_usd, teto_semanas, valor_por_semana_usd, status, data_fechamento, kind').eq('seller_id', sellerId).order('data_fechamento', { ascending: false }),
      supabase.from('fx_config').select('cotacao_manual, cotacao_travada, cotacao_referencia').eq('id', 1).maybeSingle(),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('leads').select('id, name').order('name'),
      supabase.from('collaborator_compensation_settings').select('renewal_bonus_enabled, upgrade_commission_enabled')
        .eq('seller_id', sellerId).lte('effective_from', todayISO()).order('effective_from', { ascending: false }).limit(1).maybeSingle(),
    ])

    setSalaries((salRes.data ?? []).map(s => ({ sellerId: s.seller_id, valorUsd: Number(s.valor_usd), effectiveFrom: s.effective_from })))
    // Corte (Parte 6): reuniões ≥ JUL/2026 não são comissão — não aparecem na lista/histórico do vendedor.
    setMeetings((mtgRes.data ?? []).filter(m => meetingCommissionCounts(m.met_on)).map(toMeeting))
    const ds = (dealRes.data ?? []).map(toDealUI)
    setDeals(ds)
    setClients((cliRes.data ?? []) as { id: string; name: string }[])
    setLeads((leadRes.data ?? []) as { id: string; name: string }[])
    setRenewalEnabled(!!renewalRes.data?.renewal_bonus_enabled)
    setUpgradeEnabled(!!renewalRes.data?.upgrade_commission_enabled)

    const dealIds = ds.map(d => d.id)
    if (dealIds.length) {
      const { data: wk } = await supabase.from('weekly_payments').select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').in('deal_id', dealIds)
      const kindByDeal = new Map(ds.map(d => [d.id, d.kind]))
      setWeeks((wk ?? []).map(w => toWeek(w, kindByDeal.get(w.deal_id) ?? 'sale')))
    } else {
      setWeeks([])
    }

    const m = fxRes.data?.cotacao_manual != null ? Number(fxRes.data.cotacao_manual) : null
    const t = !!fxRes.data?.cotacao_travada
    setFxManual(m); setFxTravada(t)
    setFxReferencia(fxRes.data?.cotacao_referencia != null ? Number(fxRes.data.cotacao_referencia) : null)
    setFxManualInput(m != null ? String(m) : ''); setFxTravadaInput(t)

    setLoading(false)
  }, [sellerId, supabase])

  useEffect(() => { load() }, [load])

  const changeRenewal = async (enabled: boolean) => {
    if (savingRenewal) return
    setSavingRenewal(true)
    const result = await updateRenewalBonusAction(sellerId, enabled)
    setSavingRenewal(false)
    if (result.error) { toast({ type: 'error', message: result.error.message }); return }
    setRenewalEnabled(enabled)
    toast({ type: 'success', message: enabled ? 'Bônus trimestral de US$ 50 ativado.' : 'Bônus de renovação desativado.' })
  }

  const changeUpgrade = async (enabled: boolean) => {
    if (savingUpgrade) return
    setSavingUpgrade(true)
    const result = await updateUpgradeCommissionAction(sellerId, enabled)
    setSavingUpgrade(false)
    if (result.error) { toast({ type: 'error', message: result.error.message }); return }
    setUpgradeEnabled(enabled)
    toast({ type: 'success', message: enabled ? 'Comissão parcelada de upgrade ativada.' : 'Comissão de upgrade desativada.' })
  }

  // Cotação automática (regra 5): busca server-side com cache diário + fallback. NÃO
  // bloqueia a tela — o valor aparece na hora (referência do DB) e atualiza quando volta.
  const refreshFx = useCallback(async (force = false) => {
    setFxRefreshing(true)
    try {
      const res = await fetch('/api/fx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }) })
      if (res.ok) {
        const d = await res.json()
        setFxAuto({ referencia: Number(d.referencia), effective: Number(d.effective), source: String(d.source) })
      }
    } catch { /* mantém a referência atual; nunca quebra a página */ }
    finally { setFxRefreshing(false) }
  }, [])
  useEffect(() => { refreshFx(false) }, [refreshFx])

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const fx: FxConfig = { cotacaoManual: fxManual, cotacaoTravada: fxTravada }
  // automaticRate = cotação automática do dia (referência do /api/fx), com fallback à
  // última conhecida / manual / default — NUNCA 0. A trava manual é aplicada pela engine.
  const automaticRate = fxAuto?.referencia ?? fxReferencia ?? fxManual ?? FX_FALLBACK
  const currentRate = resolveRate(fx, automaticRate)
  const summary = monthlySummary({ year: refDate.year, month: refDate.month, salaries, meetings, weeks, fx, automaticRate })
  const appliedEff = (() => {
    const firstDay = `${refDate.year}-${pad2(refDate.month)}-01`
    return salaries.filter(s => s.effectiveFrom <= firstDay).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0]?.effectiveFrom
  })()
  const vazio = summary.totalUsd === 0
  // Comissões pendentes das primeiras 4 semanas (reusa pendingCommission → dealTotal). Fonte única do total,
  // da contagem e das semanas restantes — substitui o cálculo inline que reimplementava a mesma conta.
  const pending = pendingCommission(deals, weeks)
  const semanasPendentes = pending.semanasPendentesTotais
  const monthPrefix = `${refDate.year}-${pad2(refDate.month)}`
  // Comissão por SEMANA do mês (US$25/semana), com o cliente de origem. Só exibição.
  const weeksOfMonth = weeks
    .filter(w => w.paidOn.slice(0, 7) === monthPrefix)
    .map(w => ({ ...w, clientName: deals.find(d => d.id === w.dealId)?.clientName ?? null }))
    .sort((a, b) => (a.paidOn < b.paidOn ? -1 : 1))
  const meetingsDoMes = meetings.filter(m => m.metOn.slice(0, 7) === monthPrefix)

  // Sugestões do campo de cliente (reunião e venda): clientes formais + leads, sem repetir nome.
  // Só pro datalist — o client_id continua vindo SÓ de `clients`, pra não quebrar a FK.
  const clientOptions = (() => {
    const seen = new Set<string>()
    const names: string[] = []
    for (const c of [...clients, ...leads]) {
      const key = c.name?.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      names.push(c.name)
    }
    return names
  })()
  const dealVps = (() => { const t = parseFloat(dealForm.valorTotal); const s = parseInt(dealForm.semanas); return t > 0 && s > 0 ? Math.round((t / s) * 100) / 100 : 0 })()

  // ── Salvar cotação ──────────────────────────────────────────────────────────
  const saveFx = async () => {
    setFxError('')
    const manualNum = fxManualInput.trim() === '' ? null : parseFloat(fxManualInput)
    if (fxManualInput.trim() !== '' && (isNaN(manualNum as number) || (manualNum as number) <= 0)) { setFxError('Cotação manual inválida.'); return }
    if (fxTravadaInput && manualNum == null) { setFxError('Pra travar, defina um valor manual.'); return }
    setSavingFx(true)
    const prevM = fxManual, prevT = fxTravada
    await save({
      optimistic: () => { setFxManual(manualNum); setFxTravada(fxTravadaInput) },
      run: () => updateFxConfigAction({ cotacao_manual: manualNum, cotacao_travada: fxTravadaInput }),
      rollback: () => { setFxManual(prevM); setFxTravada(prevT) },
      success: 'Cotação atualizada.',
      error: 'Não foi possível salvar a cotação',
    })
    setSavingFx(false)
  }

  // ── Salário (novo período; nunca reescreve o passado) ─────────────────────────
  const addSalary = async () => {
    setSalError('')
    const v = parseFloat(salValor)
    if (!salValor.trim() || isNaN(v) || v < 0) { setSalError('Informe um salário válido em USD.'); return }
    if (!salMonth) { setSalError('Escolha o mês de vigência.'); return }
    const effFrom = `${salMonth}-01`
    if (salaries.some(s => s.effectiveFrom === effFrom)) { setSalError('Já existe um salário com vigência nesse mês.'); return }
    setSavingSal(true)
    const { ok, data } = await save({
      run: () => addSalaryAction({ sellerId, valorUsd: v, effectiveFrom: effFrom }),
      success: `Salário de ${usd(v)} a partir de ${fmtMonthYear(effFrom)}.`,
      error: 'Não foi possível salvar o salário',
    })
    if (ok && data) {
      const d = data as { seller_id: string; valor_usd: number; effective_from: string }
      setSalaries(prev => [{ sellerId: d.seller_id, valorUsd: Number(d.valor_usd), effectiveFrom: d.effective_from }, ...prev]
        .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1)))
      setSalValor('')
    }
    setSavingSal(false)
  }

  // ── Lançar venda ──────────────────────────────────────────────────────────────
  const addDeal = async () => {
    setDealError('')
    const total = parseFloat(dealForm.valorTotal)
    const semanas = parseInt(dealForm.semanas)
    if (isNaN(total) || total <= 0) { setDealError('Valor total inválido.'); return }
    if (isNaN(semanas) || semanas <= 0) { setDealError('Número de semanas inválido.'); return }
    if (!dealForm.dataFechamento) { setDealError('Informe a data de fechamento.'); return }
    if (!dealForm.client.trim()) { setDealError('Informe o cliente da venda.'); return }
    const vps = Math.round((total / semanas) * 100) / 100
    setSavingDeal(true)
    // Servidor: can(finance,approve) + ensureClient (nunca deal órfão) + insert do deal. Regra de dinheiro intacta.
    const res = await createDealAction({ sellerId, client: dealForm.client, sellerName, total, semanas, vps, dataFechamento: dealForm.dataFechamento })
    if (res.error) { setSavingDeal(false); setDealError(res.error.message); return }
    if (res.data) {
      setDeals(prev => [toDealUI(res.data as Parameters<typeof toDealUI>[0]), ...prev])
      if (res.clientId) { const cid = res.clientId; setClients(prev => prev.some(c => c.id === cid) ? prev : [...prev, { id: cid, name: dealForm.client.trim() }]) }
      setShowNewDeal(false)
      setDealForm({ client: '', valorTotal: '100', semanas: '4', dataFechamento: todayISO() })
      toast({ type: 'success', message: 'Venda lançada.' })
    }
    setSavingDeal(false)
  }

  // ── Marcar / desmarcar semana ─────────────────────────────────────────────────
  const markWeek = async (deal: DealUI, numero: number, paidOn: string): Promise<boolean> => {
    if (!paidOn) { toast({ type: 'error', message: 'Informe a data do recebimento.' }); return false }
    const paidNums = weeks.filter(w => w.dealId === deal.id).map(w => w.numeroSemana)
    const res = await payWeekAction(deal, paidNums, numero, paidOn, currentRate)
    if (!res.ok) { toast({ type: 'error', message: payWeekMessage(res.reason, res.message) }); return false }
    if (res.row) {
      const row = res.row as Parameters<typeof toWeek>[0]
      setWeeks(prev => [...prev, toWeek(row, deal.kind)])
      toast({ type: 'success', message: `Semana ${numero} recebida em ${fmtDayMonthYear(paidOn)}.` })
    }
    return true
  }

  const unmarkWeek = async (week: WeeklyPayment) => {
    await save({
      optimistic: () => setWeeks(prev => prev.filter(w => w.id !== week.id)),
      run: () => deleteWeekAction(week.id),
      rollback: () => setWeeks(prev => [...prev, week]),
      success: 'Semana desmarcada.',
      error: 'Não foi possível desmarcar a semana',
    })
  }

  // Editar/corrigir a data de recebimento de uma semana já paga (UPDATE paid_on).
  const editWeekDate = async (week: WeeklyPayment, newDate: string): Promise<boolean> => {
    if (!newDate) { toast({ type: 'error', message: 'Informe a data.' }); return false }
    if (newDate === week.paidOn) return true
    const prevDate = week.paidOn
    const { ok } = await save({
      optimistic: () => setWeeks(ws => ws.map(w => w.id === week.id ? { ...w, paidOn: newDate } : w)),
      run: () => updateWeekDateAction(week.id, newDate),
      rollback: () => setWeeks(ws => ws.map(w => w.id === week.id ? { ...w, paidOn: prevDate } : w)),
      success: `Data da semana ${week.numeroSemana} atualizada.`,
      error: 'Não foi possível atualizar a data',
    })
    return ok
  }

  const changeDealStatus = async (deal: DealUI, status: DealStatus) => {
    const prev = deal.status
    setStatusBusyId(deal.id)
    await save({
      optimistic: () => setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, status } : d)),
      run: () => updateDealStatusAction(deal.id, status),
      rollback: () => setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, status: prev } : d)),
      success: 'Status da venda atualizado.',
      error: 'Não foi possível mudar o status',
    })
    setStatusBusyId(null)
  }

  // Excluir venda — as semanas caem por cascade (FK on delete cascade).
  const deleteDeal = async (deal: DealUI) => {
    await save({
      optimistic: () => { setDeals(ds => ds.filter(d => d.id !== deal.id)); setWeeks(ws => ws.filter(w => w.dealId !== deal.id)) },
      run: () => deleteDealAction(deal.id),
      rollback: () => { void load() },
      success: 'Venda excluída.',
      error: 'Não foi possível excluir a venda',
    })
  }

  // Editar venda. Bloqueia reduzir o nº de semanas abaixo das já pagas. Recalcula
  // o valor/semana só p/ o futuro; semanas já pagas mantêm o valor congelado.
  const editDeal = async (deal: DealUI, patch: { client: string; valorTotal: string; semanas: string; dataFechamento: string }): Promise<boolean> => {
    const total = parseFloat(patch.valorTotal)
    const semanas = parseInt(patch.semanas)
    if (isNaN(total) || total <= 0) { toast({ type: 'error', message: 'Valor total inválido.' }); return false }
    if (isNaN(semanas) || semanas <= 0) { toast({ type: 'error', message: 'Número de semanas inválido.' }); return false }
    if (!patch.dataFechamento) { toast({ type: 'error', message: 'Informe a data de fechamento.' }); return false }
    const paidCount = weeks.filter(w => w.dealId === deal.id).length
    if (semanas < paidCount) { toast({ type: 'error', message: `Já há ${paidCount} semana(s) paga(s). Desmarque antes de reduzir o número de semanas.` }); return false }
    const vps = Math.round((total / semanas) * 100) / 100
    if (!patch.client.trim()) { toast({ type: 'error', message: 'Informe o cliente da venda.' }); return false }
    const prev = deal
    const updated: DealUI = { ...deal, clientName: patch.client.trim(), valorTotalUsd: total, tetoSemanas: semanas, valorPorSemanaUsd: vps, dataFechamento: patch.dataFechamento }
    setDeals(ds => ds.map(d => d.id === deal.id ? updated : d))   // otimista
    // Servidor: can(finance,approve) + ensureClient + update do deal. Semanas já pagas seguem congeladas.
    const res = await updateDealAction(deal.id, { client: patch.client, sellerName, total, semanas, vps, dataFechamento: patch.dataFechamento })
    if (res.error) { setDeals(ds => ds.map(d => d.id === deal.id ? prev : d)); toast({ type: 'error', message: `Não foi possível atualizar a venda: ${res.error.message}` }); return false }
    if (res.clientId) { const cid = res.clientId; setClients(cs => cs.some(c => c.id === cid) ? cs : [...cs, { id: cid, name: patch.client.trim() }]) }
    toast({ type: 'success', message: 'Venda atualizada.' })
    return true
  }

  // ── Lançar / remover reunião ───────────────────────────────────────────────────
  const addMeeting = async () => {
    setMeetingError('')
    const valor = parseFloat(meetingForm.valor)
    if (isNaN(valor) || valor < 0) { setMeetingError('Valor inválido.'); return }
    if (!meetingForm.metOn) { setMeetingError('Informe a data da reunião.'); return }
    const q = meetingForm.client.trim().toLowerCase()
    const matched = clients.find(c => c.name.toLowerCase() === q)
    const matchedLead = leads.find(l => l.name.toLowerCase() === q)
    setSavingMeeting(true)
    const { ok, data } = await save({
      run: () => registerMeetingAction({
        sellerId, metOn: meetingForm.metOn, valorUsd: valor,
        clientId: matched?.id ?? null, clientName: meetingForm.client.trim() || null, note: meetingForm.note.trim() || null,
        leadId: matchedLead?.id ?? null, rate: currentRate,
      }),   // servidor: can(finance,approve) + registerMeeting + marco de reunião (se houver lead)
      success: 'Reunião lançada.',
      error: 'Não foi possível lançar a reunião',
    })
    if (ok && data) {
      setMeetings(prev => [toMeeting(data as Parameters<typeof toMeeting>[0]), ...prev])
      setShowNewMeeting(false)
      setMeetingForm({ metOn: todayISO(), valor: '15', client: '', note: '' })
    }
    setSavingMeeting(false)
  }

  const deleteMeeting = async (m: MeetingUI) => {
    await save({
      optimistic: () => setMeetings(prev => prev.filter(x => x.id !== m.id)),
      run: () => deleteMeetingAction(m.id),
      rollback: () => setMeetings(prev => [...prev, m]),
      success: 'Reunião removida.',
      error: 'Não foi possível remover a reunião',
    })
  }

  // Editar reunião (data/valor). A cotação congelada da reunião permanece.
  const editMeeting = async (m: MeetingUI, patch: { metOn: string; valor: string; client: string }): Promise<boolean> => {
    const valor = parseFloat(patch.valor)
    if (isNaN(valor) || valor < 0) { toast({ type: 'error', message: 'Valor inválido.' }); return false }
    if (!patch.metOn) { toast({ type: 'error', message: 'Informe a data.' }); return false }
    const matched = clients.find(c => c.name.toLowerCase() === patch.client.trim().toLowerCase())
    const prev = m
    const updated: MeetingUI = { ...m, metOn: patch.metOn, valorUsd: valor, clientName: patch.client.trim() || null }
    const { ok } = await save({
      optimistic: () => setMeetings(ms => ms.map(x => x.id === m.id ? updated : x)),
      run: () => updateMeetingAction(m.id, { metOn: patch.metOn, valorUsd: valor, clientId: matched?.id ?? null, clientName: patch.client.trim() || null }),
      rollback: () => setMeetings(ms => ms.map(x => x.id === m.id ? prev : x)),
      success: 'Reunião atualizada.',
      error: 'Não foi possível atualizar a reunião',
    })
    return ok
  }

  // ── PDF do mês (jsPDF) — só o recebido/realizado no mês, nada de previsão ──────
  const gerarPdf = async () => {
    const { jsPDF } = await import('jspdf')          // carrega sob demanda (fora do bundle)
    const autoTable = (await import('jspdf-autotable')).default
    const y = refDate.year, mo = refDate.month
    const mp = `${y}-${pad2(mo)}`
    const dealById = new Map(deals.map(d => [d.id, d]))
    // Quantidades do mês (SÓ EXIBIÇÃO) — mesmo conjunto/filtros que geram os valores:
    //  · Reuniões: summary.meetingsCount (= meetings com metOn no mês; qtd × US$15 = meetingsUsd)
    //  · Semanas pagas: summary.weeksCount (= weekly_payments com paidOn no mês; qtd × US$25 = weeksUsd)
    //  · Vendas no mês: deals com data_fechamento no mês e status de venda fechada/ativa (exclui interrompido).
    const vendasMes = deals.filter(d => d.kind === 'sale' && d.dataFechamento.slice(0, 7) === mp && d.status !== 'interrompido').length
    const rows: { sort: string; dia: string; acao: string; cliente: string; usd: number }[] = []
    if (summary.salaryUsd > 0) rows.push({ sort: `${mp}-01`, dia: `01/${pad2(mo)}`, acao: 'Salário fixo', cliente: '—', usd: summary.salaryUsd })
    meetings.filter(m => m.metOn.slice(0, 7) === mp).forEach(m =>
      rows.push({ sort: m.metOn, dia: fmtDayMonth(m.metOn), acao: 'Reunião', cliente: m.clientName || '—', usd: m.valorUsd }))
    weeks.filter(w => w.paidOn.slice(0, 7) === mp).forEach(w => {
      const d = dealById.get(w.dealId)
      const action = d?.kind === 'upgrade' ? `Upgrade · parcela ${w.numeroSemana}`
        : d?.kind === 'renewal' ? 'Bônus de renovação' : `Semana ${w.numeroSemana} (venda)`
      rows.push({ sort: w.paidOn, dia: fmtDayMonth(w.paidOn), acao: action, cliente: d?.clientName || '—', usd: w.valorUsd })
    })
    rows.sort((a, b) => (a.sort < b.sort ? -1 : 1))

    const lime: [number, number, number] = [79, 133, 0]
    const dark: [number, number, number] = [23, 35, 27]
    const rateStr = summary.rateUsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const doc = new jsPDF()

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...lime)
    doc.text('DR Growth', 14, 18)
    doc.setFontSize(13); doc.setTextColor(...dark); doc.text('Relatório de Comissão', 14, 26)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90)
    doc.text(`Vendedor: ${sellerName}`, 14, 34)
    doc.text(`Mês de referência: ${monthName(y, mo)}`, 14, 39)
    doc.text(`Gerado em: ${fmtDayMonthYear(todayISO())}`, 14, 44)

    doc.setDrawColor(...lime); doc.setLineWidth(0.5); doc.line(14, 49, 196, 49)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...dark); doc.text('TOTAL A PAGAR', 14, 58)
    doc.setFontSize(17); doc.setTextColor(...lime); doc.text(usd(summary.totalUsd), 14, 67)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90, 90, 90)
    doc.text(`${brl(summary.totalBrl)}  (cotação R$ ${rateStr})`, 14, 74)
    doc.setFontSize(10); doc.setTextColor(...dark)
    // Valores COM as quantidades do mês ao lado (qtd × valor unitário = valor exibido).
    doc.text(`Salário: ${usd(summary.salaryUsd)}  Vendas (${summary.salesWeeksCount} sem.): ${usd(summary.salesCommissionUsd)}  Upgrade: ${usd(summary.upgradeBonusUsd)}  Renovação: ${usd(summary.renewalBonusUsd)}`, 14, 82)
    doc.setTextColor(90, 90, 90)
    doc.text(`Reuniões no mês: ${summary.meetingsCount}    Semanas de venda pagas: ${summary.salesWeeksCount}    Vendas no mês: ${vendasMes}`, 14, 88)

    autoTable(doc, {
      startY: 94,
      head: [['Dia', 'Ação', 'Cliente', 'Valor (USD)']],
      body: rows.length ? rows.map(r => [r.dia, r.acao, r.cliente, usd(r.usd)]) : [['—', 'Sem lançamentos no mês', '—', usd(0)]],
      foot: [['', '', 'Total', usd(summary.totalUsd)]],
      theme: 'striped',
      headStyles: { fillColor: lime, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 244, 238], textColor: dark, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 3: { halign: 'right' } },
    })

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    doc.setFontSize(9); doc.setTextColor(120, 120, 120)
    doc.text(`Cotação USD->BRL usada: R$ ${rateStr} (${fxTravada ? 'travada' : 'automática'}).`, 14, finalY)
    doc.text('Valores referentes apenas ao que foi recebido/realizado no mês.', 14, finalY + 5)

    doc.save(`comissao-${sellerName.replace(/\s+/g, '-').toLowerCase()}-${mp}.pdf`)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-10 text-bento-muted text-sm gap-2"><span className="w-4 h-4 border-2 border-bento-muted/20 border-t-lime rounded-full animate-spin" />Carregando comissão...</div>
  }

  // Clientes DESTE vendedor (das vendas) → {id,name}, p/ o painel de receber/estornar por semana (client_payments).
  const sellerClients = (() => {
    const seen = new Set<string>()
    const out: { id: string; name: string }[] = []
    for (const d of deals) {
      const nm = (d.clientName || '').trim()
      if (!nm) continue
      const c = clients.find(x => x.name.toLowerCase() === nm.toLowerCase())
      if (c && !seen.has(c.id)) { seen.add(c.id); out.push(c) }
    }
    return out
  })()

  return (
    <div className="space-y-5">
      {/* lista compartilhada de clientes p/ os campos de cliente */}
      <datalist id="commission-clients">{clientOptions.map(name => <option key={name} value={name} />)}</datalist>

      {/* ── RESUMO DO MÊS ─────────────────────────────────────────────── */}
      <Collapsible icon={<Wallet className="w-4 h-4 text-lime-fg" />} title="Resumo do mês"
        peek={`${usd(summary.totalUsd)} no mês`} open={!!open.resumo} onToggle={() => toggle('resumo')}
        headerExtra={
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1 rounded-btn text-bento-muted hover:text-bento-text hover:bg-bento-bg" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-medium text-bento-text capitalize min-w-[6rem] text-center tabular-nums">{monthName(refDate.year, refDate.month)}</span>
            <button onClick={nextMonth} className="p-1 rounded-btn text-bento-muted hover:text-bento-text hover:bg-bento-bg" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
          </div>
        }>

        <div className="space-y-0.5">
          {/* Componentes da COMISSÃO (reuniões + vendas) — o salário é separado, mais abaixo. */}
          {[
            { label: `Reuniões (${summary.meetingsCount})`, u: summary.meetingsUsd, b: summary.meetingsBrl },
            { label: `Vendas (${summary.salesWeeksCount} sem.)`, u: summary.salesCommissionUsd, b: summary.salesCommissionBrl },
            { label: 'Bônus de upgrade', u: summary.upgradeBonusUsd, b: summary.upgradeBonusBrl },
            { label: 'Bônus de renovação', u: summary.renewalBonusUsd, b: summary.renewalBonusBrl },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-2 border-b border-bento-border/40">
              <span className="text-xs text-bento-muted">{r.label}</span>
              <div className="text-right">
                <p className="text-sm font-medium text-bento-text tabular-nums">{usd(r.u)}</p>
                <p className="text-[11px] text-bento-muted tabular-nums">{brl(r.b)}</p>
              </div>
            </div>
          ))}
          {/* Subtotal: comissão PURA = reuniões + vendas (sem salário). Só soma valores já recebidos. */}
          <div className="flex items-center justify-between py-2 border-b border-bento-border/40">
            <span className="text-xs font-semibold text-bento-text">Comissão (reuniões + vendas)</span>
            <div className="text-right">
              <p className="text-sm font-semibold text-bento-text tabular-nums">{usd(summary.meetingsUsd + summary.weeksUsd)}</p>
              <p className="text-[11px] text-bento-muted tabular-nums">{brl(summary.meetingsBrl + summary.weeksBrl)}</p>
            </div>
          </div>
          {/* Salário fixo — separado da comissão (não é comissão). */}
          <div className="flex items-center justify-between py-2 border-b border-bento-border/40">
            <span className="text-xs text-bento-muted">Salário fixo</span>
            <div className="text-right">
              <p className="text-sm font-medium text-bento-text tabular-nums">{usd(summary.salaryUsd)}</p>
              <p className="text-[11px] text-bento-muted tabular-nums">{brl(summary.salaryBrl)}</p>
            </div>
          </div>
          {/* Total a receber = comissão + salário (era rotulado só "Total"). */}
          <div className="flex items-center justify-between pt-2.5">
            <span className="text-sm font-semibold text-bento-text">Total a receber</span>
            <div className="text-right">
              <p className="text-base font-bold text-lime-fg tabular-nums">{usd(summary.totalUsd)}</p>
              <p className="text-xs text-bento-muted tabular-nums">{brl(summary.totalBrl)}</p>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-bento-muted pt-1 border-t border-bento-border/40">
          {vazio
            ? 'Sem lançamentos neste mês ainda — lance vendas, semanas e reuniões abaixo.'
            : `Convertido a R$ ${summary.rateUsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${fxTravada ? 'travada' : 'automática'}). Reuniões e vendas usam a cotação congelada de cada lançamento.`}
        </p>

        <button onClick={gerarPdf} className="flex items-center justify-center gap-1.5 w-full border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text py-2 rounded-btn text-sm font-medium transition-colors min-h-[44px]">
          <Download className="w-4 h-4" /> Gerar PDF do mês
        </button>
      </Collapsible>

      <Collapsible icon={<RefreshCw className="w-4 h-4 text-lime-fg" />} title="Comissão de upgrade"
        peek={upgradeEnabled ? 'Ativa · 20% em 4x' : 'Desativada'} open={!!open.upgradeProfile} onToggle={() => toggle('upgradeProfile')}>
        <div className="rounded-btn border border-bento-border/60 bg-bento-bg p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-bento-text">Upgrade parcelado</p>
              <p className="text-[11px] text-bento-muted">20% da diferença mensal entre os planos, dividido em 4 parcelas. Cada parcela só é liberada quando o cliente paga a semana.</p>
            </div>
            <button type="button" role="switch" aria-checked={upgradeEnabled} disabled={savingUpgrade}
              onClick={() => changeUpgrade(!upgradeEnabled)}
              className={cn('relative h-6 w-11 rounded-full transition-colors disabled:opacity-50', upgradeEnabled ? 'bg-lime' : 'bg-bento-border')}>
              <span className={cn('absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform', upgradeEnabled ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>
          <p className="font-tech text-[10px] text-bento-muted">Exemplo: diferença de US$ 200/mês → comissão total de US$ 40 → quatro parcelas de US$ 10. Semana não paga não libera parcela.</p>
        </div>
      </Collapsible>

      <Collapsible icon={<RefreshCw className="w-4 h-4 text-lime-fg" />} title="Renovação trimestral"
        peek={renewalEnabled ? 'Ativa · US$ 50' : 'Desativada'} open={!!open.renewal} onToggle={() => toggle('renewal')}>
        <div className="rounded-btn border border-bento-border/60 bg-bento-bg p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-bento-text">Bônus por renovação</p>
              <p className="text-[11px] text-bento-muted">US$ 50 a cada 3 meses, contados da primeira semana paga, para clientes sob responsabilidade deste vendedor.</p>
            </div>
            <button type="button" role="switch" aria-checked={renewalEnabled} disabled={savingRenewal}
              onClick={() => changeRenewal(!renewalEnabled)}
              className={cn('relative h-6 w-11 rounded-full transition-colors disabled:opacity-50', renewalEnabled ? 'bg-lime' : 'bg-bento-border')}>
              <span className={cn('absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform', renewalEnabled ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>
          <p className="font-tech text-[10px] text-bento-muted">Exemplo: primeira semana paga em 01/04 → renovações em 01/07, 01/10, 01/01… O lançamento acontece uma única vez em cada data.</p>
        </div>
      </Collapsible>

      {/* ── COMISSÃO POR SEMANA (mês selecionado) ──────────────────────── */}
      <Collapsible icon={<Wallet className="w-4 h-4 text-lime-fg" />} title="Comissão por semana"
        peek={`${weeksOfMonth.length} semana(s) · ${usd(weeksOfMonth.reduce((s, w) => s + w.valorUsd, 0))}`}
        open={!!open.semanas} onToggle={() => toggle('semanas')}>
        {weeksOfMonth.length === 0 ? (
          <p className="text-sm text-bento-muted py-2 text-center">Nenhuma semana de comissão neste mês.</p>
        ) : (
          <div className="space-y-0.5">
            {weeksOfMonth.map(w => (
              <div key={w.id} className="flex items-center justify-between py-2 border-b border-bento-border/40">
                <div className="min-w-0">
                  <p className="text-sm text-bento-text truncate">{w.clientName || 'Venda'} <span className="text-bento-muted">· sem {w.numeroSemana}</span></p>
                  <p className="font-tech text-[11px] text-bento-muted tabular-nums">{fmtDayMonthYear(w.paidOn)}</p>
                </div>
                <div className="text-right flex-none">
                  <p className="text-sm font-medium text-bento-text tabular-nums">{usd(w.valorUsd)}</p>
                  <p className="text-[11px] text-bento-muted tabular-nums">{brl(w.valorUsd * w.cotacaoUsdBrl)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2.5">
              <span className="text-sm font-semibold text-bento-text">Total semanas</span>
              <p className="text-base font-bold text-lime-fg tabular-nums">{usd(weeksOfMonth.reduce((s, w) => s + w.valorUsd, 0))}</p>
            </div>
          </div>
        )}
      </Collapsible>

      {/* ── VENDAS ────────────────────────────────────────────────────── */}
      <Collapsible icon={<Receipt className="w-4 h-4 text-lime-fg" />} title="Vendas"
        peek={`${deals.length} venda(s)${semanasPendentes > 0 ? ` · ${semanasPendentes} pend.` : ''}`}
        open={!!open.vendas} onToggle={() => toggle('vendas')}>

        {!showNewDeal && (
          <button onClick={() => setShowNewDeal(true)} className="flex items-center justify-center gap-1.5 w-full bento-btn py-2.5 rounded-btn text-sm font-semibold min-h-[44px]">
            <Plus className="w-4 h-4" /> Nova venda
          </button>
        )}

        {showNewDeal && (
          <div className="bg-bento-bg border border-bento-border/60 rounded-btn p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Cliente</label>
              <input list="commission-clients" value={dealForm.client} onChange={e => setDealForm(p => ({ ...p, client: e.target.value }))} className={inputCls} placeholder="Nome do cliente (livre ou existente)" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Valor total (USD)</label>
                <input type="number" value={dealForm.valorTotal} onChange={e => setDealForm(p => ({ ...p, valorTotal: e.target.value }))} className={inputCls} min="0" step="10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Nº de semanas</label>
                <input type="number" value={dealForm.semanas} onChange={e => setDealForm(p => ({ ...p, semanas: e.target.value }))} className={inputCls} min="1" step="1" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-bento-muted">Valor por semana (auto)</span>
              <span className="font-medium text-bento-text tabular-nums">{usd(dealVps)}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Data de fechamento</label>
              <input type="date" value={dealForm.dataFechamento} onChange={e => setDealForm(p => ({ ...p, dataFechamento: e.target.value }))} className={inputCls} />
            </div>
            {dealError && <p className="text-xs text-red-400">{dealError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowNewDeal(false); setDealError('') }} className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm hover:border-lime transition-colors min-h-[44px]">Cancelar</button>
              <button onClick={addDeal} disabled={savingDeal} className="flex-1 bento-btn py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">{savingDeal ? 'Salvando…' : 'Lançar venda'}</button>
            </div>
          </div>
        )}

        {deals.length === 0
          ? <p className="text-xs text-bento-muted py-2">Nenhuma venda lançada ainda.</p>
          : <div className="space-y-2">
              {deals.map(d => (
                <DealCard key={d.id} deal={d} weeks={weeks.filter(w => w.dealId === d.id)} statusBusy={statusBusyId === d.id}
                  onMark={(n, paidOn) => markWeek(d, n, paidOn)} onUnmark={unmarkWeek} onEditDate={editWeekDate} onChangeStatus={(s) => changeDealStatus(d, s)}
                  onEditDeal={(patch) => editDeal(d, patch)} onDeleteDeal={() => deleteDeal(d)} />
              ))}
            </div>}
      </Collapsible>

      {/* ── POR CLIENTE: recebido × falta (acumulado por venda — regra 7) ─── */}
      <Collapsible icon={<Users className="w-4 h-4 text-lime-fg" />} title="Por cliente"
        peek={pending.clientesPendentes > 0 ? `${usd(pending.totalPendenteUsd)} pendente` : `${deals.length} venda(s)`} open={!!open.porCliente} onToggle={() => toggle('porCliente')}
        headerExtra={<span className="text-[10px] text-bento-muted">acumulado</span>}>
        {deals.length === 0 ? (
          <p className="text-xs text-bento-muted py-2">Nenhuma venda lançada ainda.</p>
        ) : (
          <div className="space-y-2.5">
            {/* Resumo de pendência das 4 primeiras semanas (reusa pendingCommission → dealTotal); os cards abaixo detalham cada venda. */}
            <div className="rounded-btn border border-lime/30 bg-lime/5 px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Comissão pendente · 4 primeiras semanas</p>
                <p className="text-[11px] text-bento-dim">{pending.clientesPendentes} pendente(s) · {pending.clientesCompletos} completo(s) · {pending.semanasPendentesTotais} sem. a receber</p>
              </div>
              <span className="font-display text-lg font-bold text-lime-fg tabular-nums flex-none">{usd(pending.totalPendenteUsd)}</span>
            </div>
            {deals.map(d => {
              const dt = dealTotal(d, weeks)
              // Fallback defensivo: status fora do enum conhecido não derruba a tela (HOTFIX-REMUNERACAO-CRASH).
              const meta = CLIENT_STATUS[d.status] ?? CLIENT_STATUS.em_andamento
              const pct = d.tetoSemanas > 0 ? Math.min(100, (dt.semanasPagas / d.tetoSemanas) * 100) : 0
              return (
                <div key={d.id} className="bg-bento-bg border border-bento-border/60 rounded-btn p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-bento-text truncate">{d.clientName || 'Venda sem cliente'}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-none', meta.cls)}>{meta.label}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-bento-border/50 overflow-hidden">
                      <div className={cn('h-full rounded-full', meta.bar)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-tech text-[11px] text-bento-muted tabular-nums flex-none">{dt.semanasPagas}/{d.tetoSemanas} sem.</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Recebido</p>
                      <p className="font-display text-base font-bold text-bento-text tabular-nums leading-tight">{usd(dt.recebidoUsd)}</p>
                      <p className="font-mono text-[10px] text-bento-dim tabular-nums">~ {brl(dt.recebidoBrl)}</p>
                    </div>
                    <div>
                      <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Falta</p>
                      <p className="font-display text-base font-bold text-bento-text tabular-nums leading-tight">{usd(dt.projetadoRestanteUsd)}</p>
                      <p className="font-mono text-[10px] text-bento-dim tabular-nums">~ {brl(dt.projetadoRestanteUsd * currentRate)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Collapsible>

      {/* Receber/estornar por semana (receita = client_payments), POR CLIENTE — mesmas actions; atrás do PIN. */}
      <ClientPaymentsPanel clients={sellerClients} />

      {/* ── REUNIÕES (do mês em foco) ─────────────────────────────────── */}
      <Collapsible icon={<Handshake className="w-4 h-4 text-lime-fg" />} title={<>Reuniões de <span className="capitalize">{monthName(refDate.year, refDate.month)}</span></>}
        peek={`${meetingsDoMes.length} no mês`} open={!!open.reunioes} onToggle={() => toggle('reunioes')}>

        {!showNewMeeting && (
          <button onClick={() => setShowNewMeeting(true)} className="flex items-center justify-center gap-1.5 w-full bento-btn py-2.5 rounded-btn text-sm font-semibold min-h-[44px]">
            <Plus className="w-4 h-4" /> Nova reunião
          </button>
        )}

        {showNewMeeting && (
          <div className="bg-bento-bg border border-bento-border/60 rounded-btn p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Data</label>
                <input type="date" value={meetingForm.metOn} onChange={e => setMeetingForm(p => ({ ...p, metOn: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Valor (USD)</label>
                <input type="number" value={meetingForm.valor} onChange={e => setMeetingForm(p => ({ ...p, valor: e.target.value }))} className={inputCls} min="0" step="5" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Cliente (opcional)</label>
              <input list="commission-clients" value={meetingForm.client} onChange={e => setMeetingForm(p => ({ ...p, client: e.target.value }))} className={inputCls} placeholder="Com quem foi" />
            </div>
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Nota (opcional)</label>
              <input value={meetingForm.note} onChange={e => setMeetingForm(p => ({ ...p, note: e.target.value }))} className={inputCls} placeholder="Ex: call de descoberta" />
            </div>
            {meetingError && <p className="text-xs text-red-400">{meetingError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowNewMeeting(false); setMeetingError('') }} className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm hover:border-lime transition-colors min-h-[44px]">Cancelar</button>
              <button onClick={addMeeting} disabled={savingMeeting} className="flex-1 bento-btn py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">{savingMeeting ? 'Salvando…' : 'Lançar reunião'}</button>
            </div>
          </div>
        )}

        {meetingsDoMes.length === 0
          ? <p className="text-xs text-bento-muted py-2">Nenhuma reunião neste mês.</p>
          : <div className="space-y-1.5">
              {meetingsDoMes.map(m => (
                <MeetingRow key={m.id} meeting={m} onEdit={(patch) => editMeeting(m, patch)} onDelete={() => deleteMeeting(m)} />
              ))}
            </div>}
      </Collapsible>

      {/* ── CONFIGURAÇÃO: SALÁRIO ─────────────────────────────────────── */}
      <Collapsible icon={<DollarSign className="w-4 h-4 text-lime-fg" />} title="Salário fixo (USD)"
        peek={summary.salaryUsd > 0 ? usd(summary.salaryUsd) : 'não definido'} open={!!open.salario} onToggle={() => toggle('salario')}>
        <p className="text-[11px] text-bento-muted -mt-1">Cada mudança vira um novo registro com data de vigência. Aumento vale só pra frente — meses passados não são reescritos.</p>

        {salaries.length > 0 ? (
          <div className="space-y-1.5">
            {salaries.map(s => (
              <div key={s.effectiveFrom} className="flex items-center justify-between bg-bento-bg border border-bento-border/60 rounded-btn px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-bento-muted tabular-nums">a partir de {fmtMonthYear(s.effectiveFrom)}</span>
                  {s.effectiveFrom === appliedEff && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime/15 text-lime-fg border border-lime/30">vigente neste mês</span>}
                </div>
                <span className="text-sm font-medium text-bento-text tabular-nums">{usd(s.valorUsd)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-bento-muted py-2">Nenhum salário definido ainda.</p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Valor (USD)</label>
            <input type="number" value={salValor} onChange={e => setSalValor(e.target.value)} className={inputCls} placeholder="500.00" min="0" step="50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">A partir de</label>
            <input type="month" value={salMonth} onChange={e => setSalMonth(e.target.value)} className={inputCls} />
          </div>
        </div>
        {salError && <p className="text-xs text-red-400">{salError}</p>}
        <button onClick={addSalary} disabled={savingSal} className="flex items-center justify-center gap-1.5 w-full bento-btn py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          <Plus className="w-4 h-4" /> {savingSal ? 'Salvando…' : 'Definir salário'}
        </button>
      </Collapsible>

      {/* ── CONFIGURAÇÃO: COTAÇÃO ─────────────────────────────────────── */}
      <Collapsible icon={<RefreshCw className="w-4 h-4 text-lime-fg" />} title="Cotação USD → BRL"
        peek={`R$ ${currentRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · ${fxTravada ? 'travada' : fxAuto?.source === 'fallback' ? 'fallback' : 'auto'}`}
        open={!!open.cotacao} onToggle={() => toggle('cotacao')}
        headerExtra={<span className="text-[10px] text-bento-muted">global</span>}>

        <div className="flex items-center justify-between gap-2 bg-bento-bg border border-bento-border/60 rounded-btn px-3 py-2.5">
          <span className="text-xs text-bento-muted shrink-0">Cotação em uso</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-bento-text tabular-nums">R$ {currentRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            {(() => {
              const meta = fxSourceMeta(fxTravada ? 'manual' : fxAuto?.source)
              return (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border truncate', meta.warn ? 'bg-amber-900/30 text-amber-400 border-amber-800/50' : 'bg-lime/15 text-lime-fg border-lime/30')}>
                  {meta.text}
                </span>
              )
            })()}
          </div>
        </div>

        <button onClick={() => refreshFx(true)} disabled={fxRefreshing}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-btn text-xs font-semibold border border-bento-border text-bento-dim hover:border-lime hover:text-lime-fg transition-colors disabled:opacity-50 min-h-[40px]">
          <RefreshCw className="w-3.5 h-3.5" /> {fxRefreshing ? 'Atualizando…' : 'Atualizar cotação agora'}
        </button>

        <button onClick={() => setFxTravadaInput(v => !v)}
          className={cn('flex items-center gap-2 w-full px-3 py-2.5 rounded-btn text-sm font-medium border transition-colors min-h-[44px]',
            fxTravadaInput ? 'border-amber-800/50 text-amber-400' : 'border-bento-border text-bento-dim hover:border-lime')}>
          {fxTravadaInput ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          {fxTravadaInput ? 'Valor manual travado' : 'Automática (cotação do dia)'}
        </button>

        <div>
          <label className="block text-xs font-medium text-bento-dim mb-1">Valor manual (R$ por US$1)</label>
          <input type="number" value={fxManualInput} onChange={e => setFxManualInput(e.target.value)} className={inputCls} placeholder="5.40" min="0" step="0.01" />
        </div>
        {fxError && <p className="text-xs text-red-400">{fxError}</p>}
        <p className="text-[11px] text-bento-muted">Automática busca o dólar do dia (AwesomeAPI) com fallback à última cotação conhecida. Travar fixa no valor manual.</p>
        <button onClick={saveFx} disabled={savingFx} className="w-full bento-btn py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          {savingFx ? 'Salvando…' : 'Salvar cotação'}
        </button>
      </Collapsible>
    </div>
  )
}
