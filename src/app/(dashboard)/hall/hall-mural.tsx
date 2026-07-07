'use client'

// Primitivos de apresentação do Hall (Mural + Histórico de atividades) — extraídos VERBATIM do HallClient
// (UI-POLISH-GIANTS-001). Componentes leaf/self-contained + consts de ícone/cor. Comportamento idêntico.
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/system/TimeAgo'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { X, Clock } from 'lucide-react'
import type { Activity } from '@/types'
import type { Task } from '../tarefas/types'
import type { CalendarEvent } from './calendarShared'

export const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  lead: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  client: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  payment: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  task: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  campaign: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
  system: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>,
}

// Status semânticos (não-acento): cores próprias preservadas nos dois temas.
export const ACTIVITY_COLORS: Record<string, string> = {
  lead:     'bg-blue-900/40 text-blue-400',
  client:   'bg-lime/15 text-lime-fg',
  payment:  'bg-green-900/40 text-green-400',
  task:     'bg-amber-900/40 text-amber-400',
  campaign: 'bg-purple-900/40 text-purple-400',
  system:   'bg-slate-800/60 text-slate-400',
}

export function computeGreeting(): string {
  // Fuso canônico do app (Brasília) — não depende do fuso do navegador (B6).
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false })) % 24
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// Linha de evento de agenda no Mural (compacta, 1 linha; toca pra abrir no Calendar).
export function MuralAgendaRow({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
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
export function MuralTaskRow({ task, onClick, overdue = false }: { task: Task; onClick: () => void; overdue?: boolean }) {
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
export function HistoryModal({ onClose }: { onClose: () => void }) {
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
      <div ref={ref} {...dialogProps} aria-labelledby="history-modal-title" className="relative w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[82dvh] bg-bento-panel border border-bento-border rounded-none sm:rounded-bento shadow-card-hover flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-bento-border shrink-0">
          <h3 id="history-modal-title" className="font-display font-bold text-bento-text">{title} — Histórico</h3>
          <button onClick={onClose} aria-label="Fechar" className="min-h-9 min-w-9 p-1.5 rounded-lg text-bento-muted hover:text-bento-text hover:bg-bento-bg transition-colors flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
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
