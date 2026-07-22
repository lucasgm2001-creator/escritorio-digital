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
  if (action === 'marcar_reuniao') return 'agendamento'
  if (action === 'enviar_proposta') return 'proposta'
  if (action === 'cobrar_retorno') return 'followup'
  return 'geral'
}
