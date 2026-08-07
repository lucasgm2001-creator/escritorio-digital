'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireActionContext, toActionError, type ActionError } from '@/server/actions/safe-action'

// RENOVAÇÃO DE CONTRATO — estorno/reativação do bônus trimestral (US$50 gerado por process_due_renewals).
// TUDO acontece dentro dos RPCs que já existem no banco (SECURITY DEFINER, transação única):
//   · void_contract_renewal    → soft-delete do weekly_payment (deleted_at), deal 'interrompido', status 'nao_renovou'
//   · restore_contract_renewal → limpa deleted_at, deal 'concluido', status 'confirmada'
// Aqui NÃO há regra de dinheiro: só a guarda de permissão (admin do Financeiro, igual às demais escritas de
// comissão) e o repasse do motivo. NADA é apagado — a renovação muda de STATUS e o histórico fica na linha
// (status_note/status_changed_at/status_changed_by). Estorno é sempre decisão humana, nunca automático.

type Res = { ok: boolean; error: ActionError }

const DENY = 'Você não tem acesso de administrador ao Financeiro.'
const NOT_FOUND = 'Renovação não encontrada nesta equipe.'

async function guardFinanceAdmin() {
  return requireActionContext({ permission: { module: 'finance', action: 'approve' }, deniedMessage: DENY })
}

// O RPC devolve false quando a renovação não existe OU não é da equipe do usuário — vira erro explícito
// em vez de "sucesso" silencioso (é dinheiro: o usuário precisa saber que nada mudou).
async function runRenewalRpc(fn: 'void_contract_renewal' | 'restore_contract_renewal', renewalId: string, note: string | null): Promise<Res> {
  const g = await guardFinanceAdmin()
  if (!g.context) return { ok: false, error: g.error }
  if (!renewalId) return { ok: false, error: { message: NOT_FOUND } }
  const supabase = createClient()
  const { data, error } = await supabase.rpc(fn, { p_renewal: renewalId, p_note: note?.trim() || null })
  if (error) return { ok: false, error: toActionError(error) }
  if (data !== true) return { ok: false, error: { message: NOT_FOUND } }
  // Telas de dinheiro renderizadas no servidor (Minha Remuneração) precisam refletir o estorno na hora.
  revalidatePath('/perfil'); revalidatePath('/comercial'); revalidatePath('/clientes')
  return { ok: true, error: null }
}

// Marca a renovação como NÃO RENOVOU → estorna o bônus (a linha some da comissão, mas continua no histórico).
export async function voidRenewalAction(renewalId: string, note: string | null): Promise<Res> {
  return runRenewalRpc('void_contract_renewal', renewalId, note)
}

// Reativa a renovação (o cliente renovou mesmo / estorno indevido) → o bônus volta a contar na comissão.
export async function restoreRenewalAction(renewalId: string, note: string | null): Promise<Res> {
  return runRenewalRpc('restore_contract_renewal', renewalId, note)
}
