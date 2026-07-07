'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { cn } from '@/lib/utils'
import { updateLeadSituationAction } from './lead-write-actions'
import {
  LAST_ACTIONS, NEXT_ACTIONS, LAST_ACTION_LABEL, NEXT_ACTION_LABEL, deriveFollowupState, nextContactFromWhen,
  type LastAction, type NextAction, type LeadResponse, type WhenChoice,
} from '@/lib/commercial/situation'

// Fluxo RÁPIDO de "Atualizar situação do lead" (RADAR-COMERCIAL-001, Part 2/11). Drawer compacto — perguntas
// essenciais em chips, salvável em <20s. Reusado pela "Ação rápida" do Radar e ao concluir tarefa com lead.
// Ao concluir tarefa: `onSkip` conclui só a tarefa (não obriga). Salvar chama a action (autoridade no servidor).

const RESPONSES: { key: LeadResponse; label: string }[] = [
  { key: 'sim', label: 'Sim' }, { key: 'nao', label: 'Não' }, { key: 'nao_falei', label: 'Ainda não falei' },
]
const WHENS: { key: WhenChoice; label: string }[] = [
  { key: 'hoje', label: 'Hoje' }, { key: 'amanha', label: 'Amanhã' }, { key: 'esta_semana', label: 'Esta semana' }, { key: 'data', label: 'Data' },
]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('px-3 py-1.5 rounded-full border text-note transition-colors min-h-control-sm',
        active ? 'bg-lime/15 border-lime text-lime-fg' : 'border-bento-border text-bento-muted hover:text-bento-text')}>
      {children}
    </button>
  )
}
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-caption font-tech uppercase tracking-label text-bento-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export function SituationDrawer({ lead, onClose, onSaved, onSkip }: {
  lead: { id: string; name: string }
  onClose: () => void
  onSaved?: (result: { nextTask: Record<string, unknown> | null; patch: Record<string, unknown> }) => void
  onSkip?: () => void
}) {
  const [response, setResponse] = useState<LeadResponse | null>(null)
  const [lastAction, setLastAction] = useState<LastAction | null>(null)
  const [nextAction, setNextAction] = useState<NextAction>('nenhuma')
  const [when, setWhen] = useState<WhenChoice | null>(null)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { ref, dialogProps } = useDialog<HTMLDivElement>(onClose)

  const needsWhen = nextAction !== 'nenhuma' && nextAction !== 'aguardar'

  async function save() {
    if (!lastAction) { setError('Escolha o resultado.'); return }
    setSaving(true); setError(null)
    const res = await updateLeadSituationAction({
      leadId: lead.id, lastAction, nextAction,
      when: needsWhen ? when : null, explicitDate: when === 'data' ? (date || null) : null,
      response, note: note.trim() || null, currentSituation: note.trim() || null,
    })
    setSaving(false)
    if (res.ok) {
      // Patch otimista (mesmas funções puras do servidor) — o consumidor atualiza sem recarregar.
      const followup_state = deriveFollowupState(lastAction, nextAction, needsWhen ? when : null)
      const patch: Record<string, unknown> = {
        current_situation: note.trim() || LAST_ACTION_LABEL[lastAction],
        last_action: lastAction, next_action: nextAction, followup_state,
        situation_updated_at: new Date().toISOString(),
      }
      if (nextAction === 'nenhuma') patch.next_contact = null
      else if (needsWhen && when) patch.next_contact = nextContactFromWhen(when, when === 'data' ? (date || null) : null, new Date())
      onSaved?.({ nextTask: res.nextTask ?? null, patch })
    } else setError(res.error)
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[env(safe-area-inset-top)]">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div
          ref={ref}
          {...dialogProps}
          aria-labelledby="situation-drawer-title"
          className="relative flex w-full max-h-[calc(100dvh_-_env(safe-area-inset-top))] flex-col overflow-hidden bg-bento-panel border border-bento-border rounded-t-frame sm:rounded-frame shadow-card-hover sm:max-w-md sm:max-h-[90dvh]"
        >
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-bento-border p-5 pb-3">
            <div className="min-w-0">
              <p id="situation-drawer-title" className="text-caption font-tech uppercase tracking-label text-bento-muted">Atualizar situação</p>
              <p className="text-sm font-semibold text-bento-text truncate">{lead.name}</p>
            </div>
            <button type="button" onClick={onClose} className="text-bento-muted hover:text-bento-text shrink-0"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain p-5">
            <Group label="O lead respondeu?">
              {RESPONSES.map(r => <Chip key={r.key} active={response === r.key} onClick={() => setResponse(r.key)}>{r.label}</Chip>)}
            </Group>

            <Group label="Resultado">
              {LAST_ACTIONS.map(a => <Chip key={a} active={lastAction === a} onClick={() => setLastAction(a)}>{LAST_ACTION_LABEL[a]}</Chip>)}
            </Group>

            <Group label="Próxima ação">
              {NEXT_ACTIONS.map(a => <Chip key={a} active={nextAction === a} onClick={() => setNextAction(a)}>{NEXT_ACTION_LABEL[a]}</Chip>)}
            </Group>

            {needsWhen && (
              <Group label="Quando">
                {WHENS.map(w => <Chip key={w.key} active={when === w.key} onClick={() => setWhen(w.key)}>{w.label}</Chip>)}
                {when === 'data' && (
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="bg-bento-bg border border-bento-border rounded-btn px-3 py-1.5 text-note text-bento-text focus:outline-none focus:border-lime" />
                )}
              </Group>
            )}

            <div className="space-y-1.5">
              <p className="text-caption font-tech uppercase tracking-label text-bento-muted">Observação</p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Resumo curto da situação…"
                className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime resize-none" />
            </div>

            {error && <p className="text-caption text-red-400">{error}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-bento-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={save} disabled={saving}
              className="bento-btn px-4 min-h-control rounded-btn text-sm font-semibold flex-1 disabled:opacity-50">
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            {onSkip && (
              <button type="button" onClick={onSkip} disabled={saving}
                className="px-4 min-h-control rounded-btn text-sm font-medium text-bento-muted border border-bento-border hover:text-bento-text disabled:opacity-50">
                Pular
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}
