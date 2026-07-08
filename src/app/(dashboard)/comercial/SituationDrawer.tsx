'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { useDialog } from '@/components/ui/useDialog'
import { cn } from '@/lib/utils'
import { updateLeadSituationAction } from './lead-write-actions'
import {
  LAST_ACTION_LABEL, NEXT_ACTION_LABEL, deriveFollowupState, nextContactFromWhen,
  type LastAction, type NextAction, type LeadResponse, type Temperature, type WhenChoice,
} from '@/lib/commercial/situation'

// Fluxo RÁPIDO de "Atualizar situação do lead" (RADAR-COMERCIAL-001, Part 2/11). Drawer compacto — perguntas
// essenciais em chips, salvável em <20s. Reusado pela "Ação rápida" do Radar e ao concluir tarefa com lead.
// Ao concluir tarefa: `onSkip` conclui só a tarefa (não obriga). Salvar chama a action (autoridade no servidor).

type ContactAction = 'ligacao' | 'whatsapp' | 'cliente_contatou'

const CONTACT_ACTIONS: { key: ContactAction; label: string; summary: string }[] = [
  { key: 'ligacao', label: '📞 Ligação', summary: 'Ligação realizada' },
  { key: 'whatsapp', label: '💬 WhatsApp', summary: 'WhatsApp enviado' },
  { key: 'cliente_contatou', label: '👤 Cliente entrou em contato', summary: 'Cliente entrou em contato' },
]

const RESULT_OPTIONS: Record<ContactAction, { key: LastAction; label: string; response: LeadResponse }[]> = {
  ligacao: [
    { key: 'ligacao_nao_atendeu', label: 'Não atendeu', response: 'nao_falei' },
    { key: 'ligacao_ocupado', label: 'Ocupado', response: 'nao_falei' },
    { key: 'ligacao_caixa_postal', label: 'Caixa postal', response: 'nao_falei' },
    { key: 'ligacao_conversou', label: 'Conversou', response: 'sim' },
    { key: 'ligacao_marcou_reuniao', label: 'Marcou reunião', response: 'sim' },
    { key: 'ligacao_pediu_proposta', label: 'Pediu proposta', response: 'sim' },
    { key: 'ligacao_ja_cliente', label: 'Já é cliente', response: 'sim' },
    { key: 'ligacao_numero_invalido', label: 'Número inválido', response: 'nao' },
  ],
  whatsapp: [
    { key: 'whatsapp_nao_visualizou', label: 'Não visualizou', response: 'nao_falei' },
    { key: 'whatsapp_visualizou', label: 'Visualizou', response: 'nao_falei' },
    { key: 'whatsapp_respondeu', label: 'Respondeu', response: 'sim' },
    { key: 'whatsapp_pediu_proposta', label: 'Pediu proposta', response: 'sim' },
    { key: 'whatsapp_marcou_reuniao', label: 'Marcou reunião', response: 'sim' },
    { key: 'whatsapp_parou_responder', label: 'Parou de responder', response: 'nao' },
  ],
  cliente_contatou: [
    { key: 'cliente_pediu_proposta', label: 'Pediu proposta', response: 'sim' },
    { key: 'cliente_quer_reuniao', label: 'Quer reunião', response: 'sim' },
    { key: 'cliente_tirou_duvidas', label: 'Tirou dúvidas', response: 'sim' },
    { key: 'cliente_quer_fechar', label: 'Quer fechar', response: 'sim' },
    { key: 'cliente_quer_negociar', label: 'Quer negociar', response: 'sim' },
    { key: 'cliente_pediu_retorno', label: 'Pediu retorno', response: 'sim' },
  ],
}

const AUTO_NO_PERCEPTION_RESULTS = new Set<LastAction>([
  'ligacao_nao_atendeu',
  'ligacao_caixa_postal',
  'ligacao_numero_invalido',
  'whatsapp_nao_visualizou',
])

const PERCEPTION_OPTIONS: { key: Temperature; label: string; hint: string }[] = [
  { key: 'muito_interessado', label: '🔥 Quer fechar', hint: 'Demonstrou vontade clara de avançar.' },
  { key: 'interessado', label: '🟢 Bem interessado', hint: 'Gostou da proposta e quer continuar.' },
  { key: 'pensando', label: '🟡 Interessado, mas sem pressa', hint: 'Existe interesse, mas não é prioridade agora.' },
  { key: 'em_duvida', label: '🟡 Em dúvida', hint: 'Ainda está avaliando.' },
  { key: 'morno', label: '🟠 Precisa ser convencido', hint: 'Tem potencial, mas ainda existem objeções.' },
  { key: 'esfriando', label: '🟠 Parece que vai esfriar', hint: 'A conversa perdeu força.' },
  { key: 'pouco_interessado', label: '🔴 Pouco interessado', hint: 'Respondeu, mas dificilmente vai avançar.' },
  { key: 'nao_interessado', label: '🔴 Não quer seguir', hint: 'Disse claramente que não deseja continuar.' },
  { key: 'nao_avaliado', label: '⚫ Não consegui avaliar', hint: 'Ainda não houve conversa suficiente.' },
]

const NEXT_OPTIONS: NextAction[] = [
  'nenhuma', 'ligar', 'mensagem', 'enviar_proposta', 'cobrar_retorno',
  'marcar_reuniao', 'aguardar', 'encerrar_oportunidade',
]

const WHENS: { key: WhenChoice; label: string }[] = [
  { key: 'hoje', label: 'Hoje' }, { key: 'amanha', label: 'Amanhã' }, { key: 'em_3_dias', label: 'Em 3 dias' },
  { key: 'em_7_dias', label: 'Em 7 dias' }, { key: 'data', label: 'Escolher data' },
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

function perceptionLabel(key: Temperature | null): string | null {
  if (!key) return null
  return PERCEPTION_OPTIONS.find(o => o.key === key)?.label ?? key
}

function contactSummary(key: ContactAction | null): string | null {
  if (!key) return null
  return CONTACT_ACTIONS.find(o => o.key === key)?.summary ?? key
}

function whenLabel(when: WhenChoice | null, date: string): string | null {
  if (!when) return null
  if (when !== 'data') return WHENS.find(w => w.key === when)?.label ?? when
  if (!date) return 'Escolher data'
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

export function SituationDrawer({ lead, onClose, onSaved, onSkip }: {
  lead: { id: string; name: string }
  onClose: () => void
  onSaved?: (result: { nextTask: Record<string, unknown> | null; patch: Record<string, unknown> }) => void
  onSkip?: () => void
}) {
  const [response, setResponse] = useState<LeadResponse | null>(null)
  const [contactAction, setContactAction] = useState<ContactAction | null>(null)
  const [lastAction, setLastAction] = useState<LastAction | null>(null)
  const [temperature, setTemperature] = useState<Temperature | null>(null)
  const [nextAction, setNextAction] = useState<NextAction>('nenhuma')
  const [when, setWhen] = useState<WhenChoice | null>(null)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { ref, dialogProps } = useDialog<HTMLDivElement>(onClose)

  const resultOptions = contactAction ? RESULT_OPTIONS[contactAction] : []
  const needsWhen = nextAction !== 'nenhuma'
  const skipsPerception = !!lastAction && AUTO_NO_PERCEPTION_RESULTS.has(lastAction)
  const summaryResult = contactAction && lastAction ? RESULT_OPTIONS[contactAction].find(o => o.key === lastAction)?.label ?? LAST_ACTION_LABEL[lastAction] : null
  const summaryWhen = needsWhen ? whenLabel(when, date) : null
  const hasSummary = !!contactAction || !!summaryResult || !!temperature || nextAction !== 'nenhuma' || !!summaryWhen

  function selectContactAction(action: ContactAction) {
    setContactAction(action)
    setLastAction(null)
    setResponse(null)
    setTemperature(null)
    setError(null)
  }

  function selectResult(option: { key: LastAction; response: LeadResponse }) {
    setLastAction(option.key)
    setResponse(option.response)
    setTemperature(AUTO_NO_PERCEPTION_RESULTS.has(option.key) ? 'nao_avaliado' : null)
    setError(null)
  }

  async function save() {
    if (!contactAction) { setError('Escolha a ação realizada.'); return }
    if (!lastAction) { setError('Escolha o resultado da ação.'); return }
    if (!temperature) { setError('Escolha sua percepção do cliente.'); return }
    if (needsWhen && !when) { setError('Escolha quando realizar a próxima ação.'); return }
    if (when === 'data' && !date) { setError('Escolha a data da próxima ação.'); return }
    setSaving(true); setError(null)
    const res = await updateLeadSituationAction({
      leadId: lead.id, lastAction, nextAction,
      when: needsWhen ? when : null, explicitDate: when === 'data' ? (date || null) : null,
      temperature, response, note: note.trim() || null, currentSituation: note.trim() || LAST_ACTION_LABEL[lastAction],
    })
    setSaving(false)
    if (res.ok) {
      // Patch otimista (mesmas funções puras do servidor) — o consumidor atualiza sem recarregar.
      const followup_state = deriveFollowupState(lastAction, nextAction, needsWhen ? when : null)
      const patch: Record<string, unknown> = {
        current_situation: note.trim() || LAST_ACTION_LABEL[lastAction],
        last_action: lastAction, next_action: nextAction, temperature, followup_state,
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
            <Group label="1. Ação realizada">
              {CONTACT_ACTIONS.map(a => (
                <Chip key={a.key} active={contactAction === a.key} onClick={() => selectContactAction(a.key)}>
                  {a.label}
                </Chip>
              ))}
            </Group>

            <Group label="2. Resultado da ação">
              {resultOptions.length > 0
                ? resultOptions.map(a => (
                  <Chip key={`${contactAction}-${a.key}`} active={lastAction === a.key} onClick={() => selectResult(a)}>
                    {a.label}
                  </Chip>
                ))
                : <p className="text-note text-bento-muted">Escolha primeiro a ação realizada.</p>}
            </Group>

            {!skipsPerception && (
              <Group label="3. Como você sentiu o cliente?">
                {PERCEPTION_OPTIONS.map(t => (
                  <Chip key={t.key} active={temperature === t.key} onClick={() => { setTemperature(t.key); setError(null) }}>
                    <span title={t.hint}>{t.label}</span>
                  </Chip>
                ))}
              </Group>
            )}

            <Group label="4. Próxima ação">
              {NEXT_OPTIONS.map(a => <Chip key={a} active={nextAction === a} onClick={() => { setNextAction(a); setError(null) }}>{NEXT_ACTION_LABEL[a]}</Chip>)}
            </Group>

            {needsWhen && (
              <Group label="5. Quando realizar">
                {WHENS.map(w => <Chip key={w.key} active={when === w.key} onClick={() => setWhen(w.key)}>{w.label}</Chip>)}
                {when === 'data' && (
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="bg-bento-bg border border-bento-border rounded-btn px-3 py-1.5 text-note text-bento-text focus:outline-none focus:border-lime" />
                )}
              </Group>
            )}

            <div className="space-y-1.5">
              <p className="text-caption font-tech uppercase tracking-label text-bento-muted">6. Observação</p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="O que aconteceu nesta interação?"
                className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime resize-none" />
              <p className="text-caption text-bento-muted">Ex.: vai conversar com o sócio, pediu retorno sexta, solicitou proposta por WhatsApp.</p>
            </div>

            {hasSummary && (
              <div className="rounded-btn border border-bento-border bg-bento-bg/60 p-3">
                <p className="text-caption font-tech uppercase tracking-label text-bento-muted mb-2">Resumo desta interação</p>
                <div className="space-y-1 text-note text-bento-text">
                  {contactAction && <p>✓ {contactSummary(contactAction)}</p>}
                  {summaryResult && <p>✓ {summaryResult}</p>}
                  {temperature && <p>✓ {perceptionLabel(temperature)}</p>}
                  <p>✓ Próxima ação: {NEXT_ACTION_LABEL[nextAction]}</p>
                  {summaryWhen && <p>✓ {summaryWhen}</p>}
                </div>
              </div>
            )}

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
