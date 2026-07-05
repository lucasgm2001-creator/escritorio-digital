'use server'

import { getRequestContext } from '@/server/context/request-context'
import { createClient } from '@/lib/supabase/server'

// Lixeira (F4) — OWNER-ONLY. Lista os excluídos (via list_deleted_* SECURITY DEFINER, único caminho que
// enxerga deleted_at) e restaura / exclui definitivamente (RPCs owner-only). Sessão do usuário → auth.uid()
// → os RPCs validam o owner. Nada aqui apaga fisicamente exceto hard_delete_* (owner-only, dentro da Lixeira).
type Err = { ok: false; error: string }
type Res<T = object> = ({ ok: true } & T) | Err
const EXPIRED = 'Sessão expirada. Entre novamente.'
const ownerMsg = (m: string) => (/owner/i.test(m) ? 'Apenas o owner da equipe pode fazer isso.' : m)

export type TrashRow = { id: string; name: string; company: string | null; extra: string | null; deletedAt: string }

export async function listTrashAction(): Promise<Res<{ clients: TrashRow[]; leads: TrashRow[] }>> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: EXPIRED }
  const supabase = createClient()
  const [c, l] = await Promise.all([supabase.rpc('list_deleted_clients'), supabase.rpc('list_deleted_leads')])
  if (c.error) return { ok: false, error: c.error.message }
  if (l.error) return { ok: false, error: l.error.message }
  const asRow = (r: Record<string, unknown>, extra: string | null): TrashRow => ({
    id: String(r.id), name: String(r.name ?? 'Sem nome'), company: (r.company as string) ?? null, extra, deletedAt: String(r.deleted_at),
  })
  const clients = ((c.data ?? []) as Record<string, unknown>[]).map(r => asRow(r, (r.status as string) ?? null))
  const leads = ((l.data ?? []) as Record<string, unknown>[]).map(r => asRow(r, (r.status as string) ?? null))
  return { ok: true, clients, leads }
}

async function rpcOwner(fn: string, param: 'p_client_id' | 'p_lead_id', id: string): Promise<Res> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: EXPIRED }
  const supabase = createClient()
  const { error } = await supabase.rpc(fn, { [param]: id })
  if (error) return { ok: false, error: ownerMsg(error.message) }
  return { ok: true }
}

export const restoreClientAction = (id: string) => rpcOwner('restore_client', 'p_client_id', id)
export const restoreLeadAction = (id: string) => rpcOwner('restore_lead', 'p_lead_id', id)
export const hardDeleteClientAction = (id: string) => rpcOwner('hard_delete_client', 'p_client_id', id)
export const hardDeleteLeadAction = (id: string) => rpcOwner('hard_delete_lead', 'p_lead_id', id)
