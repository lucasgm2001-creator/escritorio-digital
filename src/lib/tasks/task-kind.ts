export type TaskKind = 'geral' | 'ligacao' | 'whatsapp' | 'agendamento' | 'reuniao' | 'proposta' | 'followup'

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  geral: 'Tarefa',
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
  agendamento: 'Agendamento',
  reuniao: 'Reunião',
  proposta: 'Proposta',
  followup: 'Follow-up',
}

export function isTaskKind(value: unknown): value is TaskKind {
  return typeof value === 'string' && value in TASK_KIND_LABEL
}

export function inferTaskKind(title: string, stored?: string | null): TaskKind {
  if (stored && stored in TASK_KIND_LABEL) return stored as TaskKind
  const value = title.toLocaleLowerCase('pt-BR')
  if (/agendar|marcar.+reuni[aã]o|confirmar.+reuni[aã]o/.test(value)) return 'agendamento'
  if (/reuni[aã]o|meeting|meet\b|apresenta[cç][aã]o/.test(value)) return 'reuniao'
  if (/proposta|or[cç]amento|contrato/.test(value)) return 'proposta'
  if (/whats|mensagem|msg\b/.test(value)) return 'whatsapp'
  if (/ligar|liga[cç][aã]o|telefon/.test(value)) return 'ligacao'
  if (/follow.?up|retorno|cobrar|acompanhar/.test(value)) return 'followup'
  return 'geral'
}

export function taskKindForNextAction(action: string): TaskKind {
  if (action === 'ligar') return 'ligacao'
  if (action === 'mensagem') return 'whatsapp'
  if (action === 'marcar_reuniao') return 'agendamento'   // tarefa PARA agendar
  if (action === 'reuniao_marcada') return 'reuniao'      // a reunião em si (roxo, com link)
  if (action === 'enviar_proposta') return 'proposta'
  if (action === 'cobrar_retorno') return 'followup'
  return 'geral'
}

// ── Tarefa automática ao MOVER o lead de fase (FUNIL-TAREFA-001) ────────────────────────────────
// Arrastar o lead para "Reunião Agendada" no funil registrava a fase e a comissão, mas NÃO criava
// tarefa nenhuma — a reunião simplesmente não aparecia na Minha Mesa. Estas são as fases que deixam
// um próximo passo em aberto; entrar nelas passa a gerar a tarefa correspondente.
// Fases fora da lista (novo, não interagiu, não respondeu, negócio futuro, fechado, perdido, lixeira)
// não geram nada: ou não pedem ação, ou o fluxo próprio já cuida.
export const STAGE_TASK: Record<string, { kind: TaskKind; title: (leadName: string) => string }> = {
  reuniao:        { kind: 'reuniao',     title: n => `Reunião: ${n}` },
  reagendamento:  { kind: 'agendamento', title: n => `Reagendar reunião: ${n}` },
  no_show:        { kind: 'followup',    title: n => `Retomar contato (no-show): ${n}` },
  proposta:       { kind: 'proposta',    title: n => `Acompanhar proposta: ${n}` },
}

export function stageTaskFor(slug: string): { kind: TaskKind; title: (leadName: string) => string } | null {
  return STAGE_TASK[slug] ?? null
}
