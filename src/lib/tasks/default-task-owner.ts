// public.sellers.id do vendedor Lucas. Não confundir com profiles.id/user_id.
export const DEFAULT_TASK_OWNER_ID = 'd129ace7-424b-4434-88af-baa3781cb568'
export const DEFAULT_TASK_OWNER_NAME = 'Lucas'

export function withDefaultTaskOwner<T extends { responsavel_id?: unknown; responsavel_nome?: unknown }>(input: T): T & {
  responsavel_id: string
  responsavel_nome: string
} {
  const id = typeof input.responsavel_id === 'string' ? input.responsavel_id.trim() : ''
  const name = typeof input.responsavel_nome === 'string' ? input.responsavel_nome.trim() : ''
  return {
    ...input,
    responsavel_id: id || DEFAULT_TASK_OWNER_ID,
    responsavel_nome: name || DEFAULT_TASK_OWNER_NAME,
  }
}
