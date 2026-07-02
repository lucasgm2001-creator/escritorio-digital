'use server'

import { getRequestContext } from '@/server/context/request-context'
import { addLeadObservation } from '@/server/services/LeadHubService'

// Server Action do Hub do Lead (ARCH-001: UI → Action → Service → Repository → Supabase).
type Result = { ok: true } | { ok: false; error: string }

export async function addLeadObservationAction(leadId: string, text: string): Promise<Result> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!text.trim()) return { ok: false, error: 'Escreva algo na observação.' }
  try {
    const item = await addLeadObservation(context, leadId, text)
    if (!item) return { ok: false, error: 'Não foi possível salvar a observação.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Não foi possível salvar a observação.' }
  }
}
