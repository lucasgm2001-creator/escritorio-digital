'use client'

// Sub-componentes de LANÇAMENTO da tela de Comissão (SPRINT-FINAL-002, Parte 2) — extraídos VERBATIM do
// CommissionSection (módulo-level, prop-driven; sem estado compartilhado com o pai). Comportamento idêntico.
import { useState, type ReactNode } from 'react'
import { Pencil, Trash2, Check, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usd, brl } from '@/lib/format'
import type { WeeklyPayment, DealStatus } from '@/lib/commission/types'
import { todayISO, addDaysISO, fmtDayMonth, fmtDayMonthYear, STATUS_CLS, inputSm, type DealUI, type MeetingUI } from './commission-shared'

// ── Card de uma venda: semanas (marcar/desmarcar) + status ────────────────────
export function DealCard({ deal, weeks, statusBusy, onMark, onUnmark, onEditDate, onChangeStatus, onEditDeal, onDeleteDeal }: {
  deal: DealUI
  weeks: WeeklyPayment[]
  statusBusy: boolean
  onMark: (numero: number, paidOn: string) => Promise<boolean>
  onUnmark: (week: WeeklyPayment) => Promise<void>
  onEditDate: (week: WeeklyPayment, newDate: string) => Promise<boolean>
  onChangeStatus: (status: DealStatus) => void
  onEditDeal: (patch: { client: string; valorTotal: string; semanas: string; dataFechamento: string }) => Promise<boolean>
  onDeleteDeal: () => Promise<void>
}) {
  const [active, setActive] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({ client: deal.clientName ?? '', valorTotal: String(deal.valorTotalUsd), semanas: String(deal.tetoSemanas), dataFechamento: deal.dataFechamento })
  const [expanded, setExpanded] = useState(false)

  const paidByNum = new Map(weeks.map(w => [w.numeroSemana, w]))
  const congelado = deal.status !== 'em_andamento'
  const pagas = weeks.length
  const pendentes = congelado ? 0 : Math.max(0, deal.tetoSemanas - pagas)
  const editVps = (() => { const t = parseFloat(editForm.valorTotal); const s = parseInt(editForm.semanas); return t > 0 && s > 0 ? Math.round((t / s) * 100) / 100 : 0 })()

  const handleMark = async (n: number) => {
    setBusy(true); const ok = await onMark(n, date); setBusy(false); if (ok) setActive(null)
  }
  const handleUnmark = async (w: WeeklyPayment) => {
    setBusy(true); await onUnmark(w); setBusy(false); setActive(null)
  }
  const handleEdit = async (w: WeeklyPayment) => {
    setBusy(true); const ok = await onEditDate(w, date); setBusy(false); if (ok) setActive(null)
  }
  const openEditDeal = () => {
    setEditForm({ client: deal.clientName ?? '', valorTotal: String(deal.valorTotalUsd), semanas: String(deal.tetoSemanas), dataFechamento: deal.dataFechamento })
    setConfirmDelete(false); setActive(null); setEditing(true)
  }
  const handleSaveEditDeal = async () => {
    setSavingEdit(true); const ok = await onEditDeal(editForm); setSavingEdit(false); if (ok) setEditing(false)
  }
  const handleDeleteDeal = async () => {
    setBusy(true); await onDeleteDeal(); setBusy(false)
  }

  return (
    <div className="bg-bento-bg border border-bento-border/60 rounded-btn">
      {/* Cabeçalho-resumo (clicável) — venda recolhida */}
      <button type="button" onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between gap-2 p-3 text-left">
        <div className="min-w-0">
          <p className="text-sm font-medium text-bento-text truncate">{deal.clientName || 'Venda sem cliente'}</p>
          <p className="text-[11px] text-bento-muted tabular-nums">{usd(deal.valorTotalUsd)} · {deal.status === 'em_andamento' ? 'em andamento' : deal.status === 'interrompido' ? 'interrompido' : 'concluído'} · {pagas}/{deal.tetoSemanas} pagas</p>
        </div>
        <svg className={cn('w-4 h-4 text-bento-muted transition-transform flex-none', expanded && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {expanded && (
      <div className="px-3 pb-3 pt-2.5 space-y-2.5 border-t border-bento-border/60">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-bento-muted tabular-nums">{deal.tetoSemanas} sem · {usd(deal.valorPorSemanaUsd)}/sem · fech. {fmtDayMonthYear(deal.dataFechamento)}</p>
        <div className="flex items-center gap-1 flex-none">
          <select value={deal.status} disabled={statusBusy} onChange={e => onChangeStatus(e.target.value as DealStatus)}
            className={cn('text-[11px] px-2 py-1 rounded-full border font-medium focus:outline-none focus:border-lime', STATUS_CLS[deal.status])}>
            <option value="em_andamento">Em andamento</option>
            <option value="interrompido">Interrompido</option>
            <option value="concluido">Concluído</option>
          </select>
          <button onClick={openEditDeal} className="p-1 text-bento-muted hover:text-bento-text" aria-label="Editar venda"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setEditing(false); setActive(null); setConfirmDelete(true) }} className="p-1 text-bento-muted hover:text-red-400" aria-label="Excluir venda"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {editing && (
        <div className="bg-bento-panel border border-bento-border rounded-btn p-2.5 space-y-2">
          <input list="commission-clients" value={editForm.client} onChange={e => setEditForm(p => ({ ...p, client: e.target.value }))} className={`w-full ${inputSm} py-1.5`} placeholder="Cliente" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={editForm.valorTotal} onChange={e => setEditForm(p => ({ ...p, valorTotal: e.target.value }))} className={`${inputSm} py-1.5`} min="0" step="10" placeholder="Valor total" />
            <input type="number" value={editForm.semanas} onChange={e => setEditForm(p => ({ ...p, semanas: e.target.value }))} className={`${inputSm} py-1.5`} min="1" step="1" placeholder="Semanas" />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-bento-muted">Valor por semana</span><span className="font-medium text-bento-text tabular-nums">{usd(editVps)}</span>
          </div>
          <input type="date" value={editForm.dataFechamento} onChange={e => setEditForm(p => ({ ...p, dataFechamento: e.target.value }))} className={`w-full ${inputSm} py-1.5`} />
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-lime transition-colors">Cancelar</button>
            <button onClick={handleSaveEditDeal} disabled={savingEdit} className="flex-1 bento-btn py-1.5 rounded-btn text-[11px] font-semibold disabled:opacity-50">{savingEdit ? 'Salvando...' : 'Salvar venda'}</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="bg-bento-panel border border-bento-border rounded-btn p-2.5 space-y-2">
          <p className="text-[11px] text-red-400">Tem certeza? Apaga a venda e as semanas dela. Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} disabled={busy} className="flex-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-bento-text transition-colors">Cancelar</button>
            <button onClick={handleDeleteDeal} disabled={busy} className="flex-1 bg-red-500/90 hover:bg-red-500 text-white py-1.5 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? 'Excluindo...' : 'Excluir venda'}</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: deal.tetoSemanas }, (_, i) => i + 1).map(n => {
          const w = paidByNum.get(n)
          const prevDate = addDaysISO(deal.dataFechamento, (n - 1) * 7)   // data prevista (não significa paga)
          return (
            <button key={n} type="button" onClick={() => { if (active === n) { setActive(null) } else { setActive(n); setDate(w ? w.paidOn : prevDate) } }}
              className={cn('flex items-center gap-1 text-[11px] px-2 py-1 rounded-btn border transition-colors',
                w ? 'bg-lime/15 text-lime-fg border-lime/30' : 'bg-bento-panel text-bento-muted border-bento-border hover:border-lime/50')}>
              {w ? <Check className="w-3 h-3" /> : <CalendarDays className="w-3 h-3 opacity-60" />}
              S{n}{w ? ` · ${fmtDayMonth(w.paidOn)}` : ` · prev. ${fmtDayMonth(prevDate)}`}
            </button>
          )
        })}
      </div>
      <p className="flex items-center gap-3 text-[10px] text-bento-muted">
        <span className="flex items-center gap-1"><Check className="w-2.5 h-2.5 text-lime-fg" /> paga (data real)</span>
        <span className="flex items-center gap-1"><CalendarDays className="w-2.5 h-2.5" /> prevista</span>
      </p>

      {active !== null && (
        paidByNum.get(active)
          ? (
            <div className="bg-bento-panel border border-bento-border rounded-btn p-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-bento-muted whitespace-nowrap">S{active} recebida em</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`flex-1 ${inputSm}`} />
                <button onClick={() => handleEdit(paidByNum.get(active)!)} disabled={busy} className="bento-btn px-2.5 py-1 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? '...' : 'Salvar'}</button>
              </div>
              <button onClick={() => handleUnmark(paidByNum.get(active)!)} disabled={busy} className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Desmarcar semana {active}
              </button>
            </div>
          )
          : (
            <div className="flex items-center gap-2 bg-bento-panel border border-bento-border rounded-btn p-2">
              <span className="text-[11px] text-bento-muted whitespace-nowrap">Recebi a S{active} em</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`flex-1 ${inputSm}`} />
              <button onClick={() => handleMark(active)} disabled={busy} className="bento-btn px-2.5 py-1 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? '...' : 'Marcar'}</button>
            </div>
          )
      )}

      {congelado
        ? <p className="text-[11px] text-amber-400">Congelado em {usd(pagas * deal.valorPorSemanaUsd)} ({pagas} de {deal.tetoSemanas} semanas).</p>
        : pendentes > 0
          ? <p className="text-[11px] text-bento-muted">{pendentes} semana(s) pendente(s) · {usd(pendentes * deal.valorPorSemanaUsd)} a receber.</p>
          : <p className="text-[11px] text-lime-fg">Todas as semanas recebidas.</p>}
      </div>
      )}
    </div>
  )
}

// ── Linha de reunião: editar (data/valor) + excluir com confirmação ───────────
export function MeetingRow({ meeting, onEdit, onDelete }: {
  meeting: MeetingUI
  onEdit: (patch: { metOn: string; valor: string; client: string }) => Promise<boolean>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState({ metOn: meeting.metOn, valor: String(meeting.valorUsd), client: meeting.clientName ?? '' })
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const openEdit = () => { setForm({ metOn: meeting.metOn, valor: String(meeting.valorUsd), client: meeting.clientName ?? '' }); setConfirming(false); setEditing(true) }
  const handleSave = async () => { setBusy(true); const ok = await onEdit(form); setBusy(false); if (ok) setEditing(false) }
  const handleDelete = async () => { setBusy(true); await onDelete(); setBusy(false) }

  return (
    <div className="bg-bento-bg border border-bento-border/60 rounded-btn">
      {/* Cabeçalho-resumo (clicável) — reunião recolhida */}
      <button type="button" onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left">
        <div className="min-w-0">
          <p className="text-sm text-bento-text truncate">{meeting.clientName ? `Reunião · ${meeting.clientName}` : 'Reunião'}</p>
          <p className="text-[11px] text-bento-muted tabular-nums">{fmtDayMonthYear(meeting.metOn)} · {usd(meeting.valorUsd)} · {brl(meeting.valorUsd * meeting.cotacaoUsdBrl)}</p>
        </div>
        <svg className={cn('w-4 h-4 text-bento-muted transition-transform flex-none', expanded && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {expanded && (
      <div className="px-3 pb-3 pt-2 space-y-2 border-t border-bento-border/60">
        {!editing && !confirming && (
          <div className="flex gap-2">
            <button onClick={openEdit} className="flex-1 flex items-center justify-center gap-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-lime transition-colors"><Pencil className="w-3.5 h-3.5" /> Editar</button>
            <button onClick={() => { setEditing(false); setConfirming(true) }} className="flex-1 flex items-center justify-center gap-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-red-400/50 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
          </div>
        )}
      {editing && (
        <div className="space-y-2">
          <input list="commission-clients" value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} className={`w-full ${inputSm} py-1.5`} placeholder="Cliente" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.metOn} onChange={e => setForm(p => ({ ...p, metOn: e.target.value }))} className={`${inputSm} py-1.5`} />
            <input type="number" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} className={`${inputSm} py-1.5`} min="0" step="5" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-lime transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={busy} className="flex-1 bento-btn py-1.5 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? '...' : 'Salvar'}</button>
          </div>
        </div>
      )}
      {confirming && (
        <div className="space-y-2">
          <p className="text-[11px] text-red-400">Excluir esta reunião? Não pode ser desfeito.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} disabled={busy} className="flex-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-bento-text transition-colors">Cancelar</button>
            <button onClick={handleDelete} disabled={busy} className="flex-1 bg-red-500/90 hover:bg-red-500 text-white py-1.5 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? 'Excluindo...' : 'Excluir'}</button>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  )
}

// ── Seção recolhível (cabeçalho clicável + espiada quando fechada) ────────────
export function Collapsible({ icon, title, peek, open, onToggle, headerExtra, children }: {
  icon: ReactNode
  title: ReactNode
  peek?: ReactNode
  open: boolean
  onToggle: () => void
  headerExtra?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bento-fx p-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onToggle} className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
          {icon}
          <span className="text-sm font-semibold text-bento-text truncate">{title}</span>
          {!open && peek != null && <span className="font-tech text-[11px] text-bento-muted truncate">· {peek}</span>}
        </button>
        <div className="flex items-center gap-1.5 flex-none">
          {headerExtra}
          <button type="button" onClick={onToggle} className="p-1 text-bento-muted hover:text-bento-text" aria-label="Abrir/fechar">
            <svg className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      </div>
      {open && <div className="space-y-3 mt-3">{children}</div>}
    </section>
  )
}
