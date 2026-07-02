'use server'

import { getRequestContext } from '@/server/context/request-context'

// Seam de MUTAÇÃO do domínio Pessoas: UI → Server Action → Service → Repository → Supabase (ARCH-001).
// Reservado para COMPENSATION-001 / PERMISSION-001. Nesta fase NÃO persiste (sem banco) — retorna um
// resultado controlado. Quando o Service/Repository de escrita existir, só o corpo destes métodos muda.

type ActionResult = { ok: true } | { ok: false; error: string }

const NOT_AVAILABLE = 'Gestão de pessoas estará disponível nas próximas fases.'

export async function createDepartmentAction(input: { name: string }): Promise<ActionResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!input?.name?.trim()) return { ok: false, error: 'Informe o nome do departamento.' }
  return { ok: false, error: NOT_AVAILABLE }
}

export async function createRoleAction(input: { name: string; departmentId: string | null }): Promise<ActionResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!input?.name?.trim()) return { ok: false, error: 'Informe o nome do cargo.' }
  return { ok: false, error: NOT_AVAILABLE }
}
