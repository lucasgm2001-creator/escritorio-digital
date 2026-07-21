'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveClientHistoryAction, registerPlanUpgradeAction, voidPlanUpgradeAction } from './client-write-actions'
import { useToast } from '@/components/ui/toast'
import { FUSO_OPTIONS } from '../comercial/types'
import { US_STATES, sanitizeAreaCode } from '@/lib/usStates'
import { resolvePhoneGeo, type PhoneGeo } from '@/lib/geo/phone-geo'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { DossieTab } from './DossieTab'
import type { Client } from './types'
import { useRole } from '@/components/auth/RoleProvider'

interface Plan { id: string; nome: string; valor_semanal: number; valor_mensal: number | null }
interface Seller { id: string; name: string }
interface UpgradeHistory { id: string; old_plan_id: string | null; new_plan_id: string; changed_at: string; effective_week: number | null; bonus_usd: number; observacao: string | null }
// Dia de pagamento da semana — 0=Dom..6=Sáb, mesma convenção do agendador automático (getUTCDay civil).
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: 'Domingo' }, { value: 1, label: 'Segunda' }, { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' }, { value: 4, label: 'Quinta' }, { value: 5, label: 'Sexta' }, { value: 6, label: 'Sábado' },
]
// Dia-da-semana (0=Dom..6=Sáb) de um YMD, na convenção do cron. Default p/ cliente legado sem o dia: o dia do start_date.
const weekdayOf = (d?: string | null): number => {
  const ymd = (d || new Date().toISOString()).slice(0, 10)
  const [y, m, dd] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, dd)).getUTCDay()
}
const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

// Modal de edição de cliente — COMPARTILHADO entre a aba Clientes e a aba Contatos. Ao Salvar, grava o cliente
// E reconstrói o HISTÓRICO (saveClientHistoryAction). O telefone auto-preenche DDD/estado/cidade
// pela MESMA regra do mapa (src/data/us-map.json > areaCodes), carregado sob demanda (lazy).
export function ClienteModal({ client, onClose, onSaved, initialTab }: {
  client: Client
  onClose: () => void
  onSaved: (updated: Client) => void
  initialTab?: 'editar' | 'dossie'   // abre direto numa aba (default: Editar)
}) {
  const supabase = createClient()
  const role = useRole()
  const canManageFinance = role === 'owner' || role === 'admin'
  const { toast } = useToast()
  const [view, setView] = useState<'editar' | 'dossie'>(initialTab ?? 'editar')
  const [plans, setPlans] = useState<Plan[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(false)
  const [upgradePlan, setUpgradePlan] = useState('')
  const [upgradeDate, setUpgradeDate] = useState(new Date().toISOString().slice(0, 10))
  const [upgradeSeller, setUpgradeSeller] = useState('')
  const [upgradeWeek, setUpgradeWeek] = useState('')
  const [upgradeNote, setUpgradeNote] = useState('')
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeHistory, setUpgradeHistory] = useState<UpgradeHistory[]>([])
  const [voidingUpgrade, setVoidingUpgrade] = useState<string | null>(null)
  const [geoSug, setGeoSug] = useState<PhoneGeo | null>(null)   // sugestão de cidade/estado a partir do telefone (Parte 2)
  const [form, setForm] = useState({
    name: client.name, company: client.company ?? '', email: client.email ?? '', phone: client.phone ?? '',
    plano_id: client.plano_id ?? '', dia_pagamento_semana: String(client.dia_pagamento_semana ?? weekdayOf(client.start_date)),
    periodicidade: (client.periodicidade ?? 'semanal') as 'semanal' | 'mensal',
    start_date: (client.start_date ?? '').slice(0, 10),
    responsavel: client.assigned_name ?? '',
    forma_pagamento: client.forma_pagamento ?? '',  // Parte 2 — PIX/cartão/transferência/etc. (texto livre)
    // Valor personalizado (Parte 2): se preenchido, vira o valor SEMANAL e o cliente fica sem plano. Pré-carrega
    // o plan_weekly quando o cliente já é "sem plano" (plano_id null) — senão fica vazio (herda do plano).
    valorCustom: client.plano_id ? '' : (client.plan_weekly ? String(client.plan_weekly) : ''),
    // HISTÓRICO do pipeline (CLIENT-HISTORY-ADMIN-003) — datas REAIS; ao Salvar, o sistema reconstrói tudo
    // automaticamente (lead → contato → reunião → proposta → fechamento + semanas/comissão). Vazio = mantém.
    leadDate: '', firstContact: '', meetingDate: '', proposalDate: '', closeDate: '',
    fuso: client.fuso ?? '', nicho: client.nicho ?? '',
    city: client.city ?? '', state: client.state ?? '', area_code: client.area_code ?? '',
  })

  useEffect(() => {
    supabase.from('plans').select('id, nome, valor_semanal, valor_mensal').eq('ativo', true).order('ordem')
      .then(({ data }) => setPlans((data ?? []) as Plan[]))
    supabase.from('sellers').select('id, name').eq('status', 'ativo').eq('gera_comissao', true).order('name')
      .then(({ data }) => {
        const rows = (data ?? []) as Seller[]
        setSellers(rows)
        setUpgradeSeller(rows.find(s => s.name.trim().toLowerCase() === 'lucas')?.id ?? rows[0]?.id ?? '')
      })
    if (canManageFinance) {
      supabase.from('plan_changes').select('id, old_plan_id, new_plan_id, changed_at, effective_week, bonus_usd, observacao')
        .eq('client_id', client.id).is('voided_at', null).order('changed_at', { ascending: false })
        .then(({ data }) => setUpgradeHistory((data ?? []) as UpgradeHistory[]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Telefone → SUGESTÃO de geografia (Parte 2): EUA (area code) ou Brasil (DDD), via resolvePhoneGeo (fonte única).
  // NÃO preenche sozinho — só sugere; o usuário aplica (applyGeo) ou ignora. Não sobrescreve dado manual sem confirmar.
  const onPhoneChange = (phone: string) => {
    setForm(p => ({ ...p, phone }))
    resolvePhoneGeo(phone).then(geo => setGeoSug(geo)).catch(() => setGeoSug(null))
  }
  // A sugestão só aparece se DIFERE do que já está no formulário (senão não há o que aplicar).
  const geoDiffers = !!geoSug && (
    geoSug.areaCode !== (form.area_code || '') ||
    (!!geoSug.state && geoSug.state !== (form.state || '')) ||
    (!!geoSug.city && geoSug.city !== (form.city || ''))
  )
  const applyGeo = () => {
    if (!geoSug) return
    setForm(p => ({ ...p, area_code: geoSug.areaCode, ...(geoSug.state ? { state: geoSug.state } : {}), ...(geoSug.city ? { city: geoSug.city } : {}) }))
    setGeoSug(null)
  }

  const buildPatch = () => {
    const editPlan = plans.find(p => p.id === form.plano_id)
    const custom = Number(form.valorCustom)
    const hasCustom = form.valorCustom.trim() !== '' && custom > 0
    return {
      name: form.name || client.name,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      // Valor personalizado (Parte 2): se informado, é o valor semanal e o cliente fica SEM plano (plano_id null).
      // Senão, herda do plano selecionado. O motor sempre lê plan_weekly (resolveClientPlan) — regra intacta.
      plano_id: hasCustom ? null : (form.plano_id || client.plano_id || null),
      plan_weekly: hasCustom ? custom : (editPlan?.valor_semanal ?? client.plan_weekly),
      dia_pagamento_semana: Number(form.dia_pagamento_semana),
      periodicidade: form.periodicidade,     // forma de cobrança (F2)
      forma_pagamento: form.forma_pagamento.trim() || null,  // Parte 2 — método (texto livre)
      start_date: form.start_date || null,   // editável/retroativo (CLIENT-HISTORY-F1)
      assigned_name: form.responsavel.trim() || null,  // responsável (histórico)
      nicho: form.nicho.trim() || null,
      fuso: form.fuso || null,
      city: form.city.trim() || null,
      state: form.state || null,
      area_code: form.area_code || null,
    }
  }

  // SAVE = persistir o cliente + reconstruir o HISTÓRICO automaticamente (CLIENT-HISTORY-ADMIN-003). Não há mais
  // botão "Reconstruir histórico": ao salvar, o sistema costura lead → contato → reunião → proposta → fechamento
  // e as semanas/comissão nas DATAS reais. Campos de data vazios = mantém o que já existe (idempotente).
  const handleSave = async () => {
    setLoading(true)
    const patch = buildPatch()
    const history = {
      startDate: form.start_date || '',
      leadDate: form.leadDate || null,
      firstContact: form.firstContact || null,
      meetingDate: form.meetingDate || null,
      proposalDate: form.proposalDate || null,
      closeDate: form.closeDate || null,
    }
    const res = await saveClientHistoryAction(client.id, patch, history)
    setLoading(false)
    if (!res.ok) { toast({ type: 'error', message: res.error }); return }
    onSaved({ ...client, ...patch } as Client)
    if (res.reconstructed) {
      const parts: string[] = []
      if (res.createdLead) parts.push('lead')
      if (res.createdMeeting) parts.push('reunião')
      if (res.createdDeal) parts.push('venda')
      if (res.stageEvents) parts.push(`${res.stageEvents} fase(s)`)
      if (res.marked.length) parts.push(`${res.marked.length} semana(s) agendada(s)`)
      if (res.redated) parts.push(`${res.redated} corrigida(s)`)
      toast({ type: 'success', message: parts.length ? `Salvo · histórico: ${parts.join(' · ')}.` : 'Cliente salvo e histórico reconstruído.' })
    } else {
      toast({ type: 'success', message: 'Cliente atualizado.' })
    }
    onClose()
  }

  // Upgrade de plano (F3): move o cliente para um plano maior e lança o bônus (só a diferença) na comissão.
  const handleUpgrade = async () => {
    if (upgrading || !upgradePlan) return
    setUpgrading(true)
    try {
      const effectiveWeek = upgradeWeek.trim() === '' ? null : Number(upgradeWeek)
      const res = await registerPlanUpgradeAction(client.id, upgradePlan, upgradeDate, {
        sellerId: upgradeSeller || null,
        effectiveWeek: effectiveWeek != null && Number.isInteger(effectiveWeek) && effectiveWeek > 0 ? effectiveWeek : null,
        observacao: upgradeNote || null,
      })
      if (!res.ok) { toast({ type: 'error', message: res.error }); return }
      const np = plans.find(p => p.id === upgradePlan)
      onSaved({ ...client, plano_id: upgradePlan, plan_weekly: np?.valor_semanal ?? client.plan_weekly } as Client)
      setForm(p => ({ ...p, plano_id: upgradePlan }))
      setUpgradePlan('')
      setUpgradeWeek('')
      setUpgradeNote('')
      const { data: history } = await supabase.from('plan_changes').select('id, old_plan_id, new_plan_id, changed_at, effective_week, bonus_usd, observacao')
        .eq('client_id', client.id).is('voided_at', null).order('changed_at', { ascending: false })
      setUpgradeHistory((history ?? []) as UpgradeHistory[])
      toast({ type: 'success', message: res.bonus > 0 ? `Upgrade registrado · comissão US$${res.bonus} em 4× US$${res.weeklyBonus}, liberada conforme o cliente paga.` : `Upgrade registrado (vendedor sem perfil de upgrade ativo).` })
    } finally { setUpgrading(false) }
  }

  const cancelUpgrade = async (upgrade: UpgradeHistory) => {
    if (voidingUpgrade || !window.confirm('Cancelar este upgrade e estornar as parcelas de bônus vinculadas?')) return
    const reason = window.prompt('Motivo da correção (opcional):')
    if (reason === null) return
    setVoidingUpgrade(upgrade.id)
    try {
      const res = await voidPlanUpgradeAction(upgrade.id, reason)
      if (!res.ok) { toast({ type: 'error', message: res.error }); return }
      setUpgradeHistory(rows => rows.filter(row => row.id !== upgrade.id))
      const previous = plans.find(p => p.id === upgrade.old_plan_id)
      setForm(p => ({ ...p, plano_id: upgrade.old_plan_id ?? '' }))
      onSaved({ ...client, plano_id: upgrade.old_plan_id, plan_weekly: previous?.valor_semanal ?? client.plan_weekly } as Client)
      toast({ type: 'success', message: 'Upgrade cancelado e bônus vinculado estornado.' })
    } finally { setVoidingUpgrade(null) }
  }

  const { ref, dialogProps } = useDialog(onClose)
  return (
    <Portal>
    <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[300] p-0 sm:p-4">
      <div ref={ref} {...dialogProps} aria-labelledby="cliente-modal-title" onClick={e => e.stopPropagation()} className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-md max-h-[92dvh] flex flex-col overflow-hidden animate-slide-up">
        <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-3">
          <h2 id="cliente-modal-title" className="font-display font-bold text-bento-text truncate">{client.name}</h2>
          <button onClick={onClose} aria-label="Fechar" className="min-h-9 min-w-9 rounded-lg text-bento-muted hover:text-bento-text hover:bg-bento-bg transition-colors shrink-0 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {/* Abas — rolam na horizontal no celular, sem quebrar linha. */}
        <div className="flex shrink-0 flex-nowrap gap-1 px-5 border-b border-bento-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([['editar', 'Editar'], ['dossie', 'Dossiê']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={cn('px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0 whitespace-nowrap',
                view === v ? 'border-lime text-lime-fg' : 'border-transparent text-bento-muted hover:text-bento-text')}>{l}</button>
          ))}
        </div>

        {view === 'dossie' && <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5"><DossieTab client={client} onSaved={onSaved} /></div>}

        {view === 'editar' && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Nome</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={client.name} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Empresa</label>
            <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder={client.company ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Email</label>
            <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder={client.email ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Telefone</label>
            <input value={form.phone} onChange={e => onPhoneChange(e.target.value)} placeholder={client.phone ?? '+1 (555) 123-4567'} className={inputCls} />
            {geoDiffers ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-btn border border-lime/30 bg-lime/10 px-2.5 py-1.5">
                <span className="text-[11px] text-bento-text flex-1 min-w-0 truncate">Detectamos: <span className="font-medium">{geoSug!.label}</span></span>
                <button type="button" onClick={applyGeo} className="text-[11px] font-semibold text-lime-fg hover:underline shrink-0">Aplicar</button>
                <button type="button" onClick={() => setGeoSug(null)} aria-label="Ignorar" className="text-bento-muted hover:text-bento-text shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <p className="font-tech text-[10px] text-bento-muted/70 mt-1">Telefone dos EUA/Brasil sugere estado e cidade — você aceita ou ignora.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Plano</label>
            <select value={form.plano_id} onChange={e => setForm(p => ({ ...p, plano_id: e.target.value }))} className={inputCls}>
              {plans.length === 0 && <option value="">Carregando…</option>}
              {plans.map(p => <option key={p.id} value={p.id}>{p.nome} — ${p.valor_semanal}/sem{p.valor_mensal ? ` · $${p.valor_mensal}/mês` : ''}</option>)}
            </select>
          </div>
          {/* Valor personalizado (Parte 2) — sobrescreve o plano: vira o valor SEMANAL do cliente (sem plano).
              Deixe vazio para usar o plano. O motor lê plan_weekly (resolveClientPlan) — regra intacta. */}
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Valor personalizado (semanal, opcional)</label>
            <input type="number" min="0" step="1" inputMode="decimal" value={form.valorCustom}
              onChange={e => setForm(p => ({ ...p, valorCustom: e.target.value }))} placeholder="Ex.: 175 — vazio usa o plano" className={inputCls} />
            {form.valorCustom.trim() !== '' && Number(form.valorCustom) > 0 && (
              <p className="font-tech text-[10px] text-bento-muted/70 mt-1">Cliente sem plano — vale US$ {Number(form.valorCustom)}/semana.</p>
            )}
          </div>
          {/* Forma de cobrança (F2) — semanal ou mensal. O motor é sempre semanal; "mensal" só muda como
              se registra o pagamento (quita o mês de uma vez via payMonth). Não altera o valor por semana. */}
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Cobrança</label>
            <select value={form.periodicidade} onChange={e => setForm(p => ({ ...p, periodicidade: e.target.value as 'semanal' | 'mensal' }))} className={inputCls}>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal (quita o mês de uma vez)</option>
            </select>
          </div>
          {/* Forma de pagamento (Parte 2) — método (PIX, cartão, transferência...). Só cadastro; não afeta o motor. */}
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Forma de pagamento</label>
            <input value={form.forma_pagamento} onChange={e => setForm(p => ({ ...p, forma_pagamento: e.target.value }))} placeholder="Ex.: PIX, cartão, transferência" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Dia de pagamento (semana)</label>
            <select value={form.dia_pagamento_semana} onChange={e => setForm(p => ({ ...p, dia_pagamento_semana: e.target.value }))} className={inputCls}>
              {WEEKDAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          {/* Data de início do contrato — pode ser RETROATIVA (cliente histórico). Alimenta "dias como
              cliente", cronograma de cobrança e a competência da comissão (CLIENT-HISTORY-F1). */}
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Data de início do contrato</label>
            <input type="date" value={form.start_date} max={new Date().toISOString().slice(0, 10)}
              onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className={inputCls} />
            <p className="font-tech text-[10px] text-bento-muted/70 mt-1">Pode ser retroativa (cliente histórico) — alimenta dias como cliente, cobrança e comissão.</p>
          </div>
          {/* HISTÓRICO do pipeline (CLIENT-HISTORY-ADMIN-003) — datas REAIS da jornada. Ao Salvar, o sistema
              reconstrói TUDO automaticamente (funil, timeline, receita e comissão) nas datas informadas, como se
              o cliente tivesse entrado naquela época. Não há mais botão de reconstruir. Vazio = mantém o atual. */}
          <div className="rounded-btn border border-bento-border/60 bg-bento-bg p-3 space-y-2.5">
            <div>
              <p className="text-xs font-medium text-bento-text">Histórico</p>
              <p className="font-tech text-[10px] text-bento-muted leading-relaxed">
                Datas reais da jornada. Ao <span className="text-bento-text">Salvar</span>, o sistema reconstrói
                sozinho o funil, a timeline, a receita e a comissão — como se o cliente tivesse entrado naquela época.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                ['leadDate', 'Data do lead'], ['firstContact', 'Primeiro contato'], ['meetingDate', 'Reunião'],
                ['proposalDate', 'Proposta'], ['closeDate', 'Fechamento'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[11px] font-medium text-bento-dim mb-1">{label}</label>
                  <input type="date" value={form[key]} max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className={inputCls} />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-medium text-bento-dim mb-1">Responsável</label>
                <input value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} placeholder="Vendedor" className={inputCls} />
              </div>
            </div>
          </div>
          {/* Upgrade de plano (F3) — muda o cliente p/ um plano MAIOR e lança o bônus (SÓ a diferença) na
              comissão do mês, pela config do vendedor. Não duplica; competência = data do upgrade. */}
          {canManageFinance && <div className="rounded-btn border border-bento-border/60 bg-bento-bg p-3 space-y-2">
            <p className="text-xs font-medium text-bento-text">Upgrade de plano</p>
            <p className="font-tech text-[10px] text-bento-muted leading-relaxed">Define o novo plano, a semana em que passa a valer e quem realizou o upgrade. Lucas vem selecionado por padrão.</p>
            <div className="flex gap-2">
              <select value={upgradePlan} onChange={e => setUpgradePlan(e.target.value)} className={cn(inputCls, 'flex-1')}>
                <option value="">Novo plano…</option>
                {plans.filter(p => p.id !== form.plano_id).map(p => <option key={p.id} value={p.id}>{p.nome} — ${p.valor_semanal}/sem</option>)}
              </select>
              <input type="date" value={upgradeDate} max={new Date().toISOString().slice(0, 10)} onChange={e => setUpgradeDate(e.target.value)} className={cn(inputCls, 'w-36')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-bento-muted mb-1">Vendedor do upgrade</label>
                <select value={upgradeSeller} onChange={e => setUpgradeSeller(e.target.value)} className={inputCls}>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-bento-muted mb-1">Começa na semana</label>
                <input type="number" min="1" step="1" value={upgradeWeek} onChange={e => setUpgradeWeek(e.target.value)} placeholder="Próxima" className={inputCls} />
              </div>
            </div>
            <p className="font-tech text-[10px] text-bento-muted">Comissão: 20% da diferença mensal em 4 parcelas. Só libera cada parcela após o pagamento da semana pelo cliente.</p>
            <textarea rows={2} value={upgradeNote} onChange={e => setUpgradeNote(e.target.value)} placeholder="Observação do upgrade (opcional)" className={inputCls} />
            <button type="button" onClick={handleUpgrade} disabled={upgrading || !upgradePlan}
              className="w-full px-3 py-2 rounded-btn text-xs font-semibold border border-lime/40 text-lime-fg hover:bg-lime/10 transition-colors disabled:opacity-50">
              {upgrading ? 'Registrando…' : 'Registrar upgrade'}
            </button>
            {upgradeHistory.length > 0 && <div className="pt-2 border-t border-bento-border/60 space-y-1.5">
              <p className="font-tech text-[10px] uppercase tracking-wider text-bento-muted">Histórico de upgrades</p>
              {upgradeHistory.map((upgrade, index) => <div key={upgrade.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-bento-dim flex-1">{upgrade.changed_at} · semana {upgrade.effective_week ?? 'automática'} · bônus ${Number(upgrade.bonus_usd).toFixed(2)}</span>
                {index === 0 && <button type="button" disabled={voidingUpgrade === upgrade.id} onClick={() => cancelUpgrade(upgrade)} className="text-red-300 hover:text-red-200 disabled:opacity-50">Cancelar</button>}
              </div>)}
            </div>}
          </div>}
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Nicho</label>
            <input value={form.nicho} onChange={e => setForm(p => ({ ...p, nicho: e.target.value }))} placeholder="Ex: Roofing, HVAC..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Fuso horário</label>
            <select value={form.fuso} onChange={e => setForm(p => ({ ...p, fuso: e.target.value }))} className={inputCls}>
              <option value="">Sem fuso</option>
              {FUSO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Localização (EUA) — alimenta o Mapa (city/state/area_code). Editável após o auto-preenchimento. */}
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Cidade (EUA)</label>
            <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Ex.: New York City" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Estado</label>
              <select value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className={inputCls}>
                <option value="">Selecione...</option>
                {US_STATES.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">DDD (area code)</label>
              <input inputMode="numeric" maxLength={3} value={form.area_code} onChange={e => setForm(p => ({ ...p, area_code: sanitizeAreaCode(e.target.value) }))} placeholder="Ex.: 212" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm hover:border-lime hover:text-bento-text transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={loading} className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50">{loading ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
        )}
      </div>
    </div>
    </Portal>
  )
}
