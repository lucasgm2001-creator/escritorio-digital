'use server'

import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { getClientObservations } from '@/server/services/ObservationService'

// Contexto para PREPARAR a reunião de onboarding (ONBOARDING-005).
//
// As observações saem do getClientObservations — a MESMA fonte da aba Observações do cliente, que resolve
// o lead de origem e junta os dois históricos. A primeira versão consultava entity_observations direto com
// entity_type='client' e perdia tudo o que foi anotado na fase de lead: são 257 registros de lead contra 3
// de cliente na base, ou seja, a tela apareceria vazia para quase todo mundo.

export type PrepDados = {
  company: string | null
  phone: string | null
  email: string | null
  nicho: string | null
  planWeekly: number | null
  planoNome: string | null
  formaPagamento: string | null
  billingEvery: number | null
  billingUnit: string | null
}

export type PrepResult =
  | { ok: true; dados: PrepDados | null; observacoes: { body: string; createdAt: string; autor: string | null }[] }
  | { ok: false; error: string }

export async function getOnboardingPrepAction(clientId: string): Promise<PrepResult> {
  const context = await getRequestContext()
  if (!context?.activeTeamId) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!can(context, 'clients', 'view')) return { ok: false, error: 'Sem acesso a este cliente.' }

  const supabase = createClient()
  const [{ data: c }, obs] = await Promise.all([
    supabase.from('clients')
      .select('company, phone, email, nicho, plan_weekly, forma_pagamento, billing_every, billing_unit, plans(nome)')
      .eq('id', clientId).eq('team_id', context.activeTeamId).is('deleted_at', null).maybeSingle(),
    getClientObservations(context, clientId),
  ])

  const plano = (c as { plans?: { nome?: string } | null } | null)?.plans
  return {
    ok: true,
    dados: c ? {
      company: c.company as string | null,
      phone: c.phone as string | null,
      email: c.email as string | null,
      nicho: c.nicho as string | null,
      planWeekly: c.plan_weekly != null ? Number(c.plan_weekly) : null,
      planoNome: plano?.nome ?? null,
      formaPagamento: c.forma_pagamento as string | null,
      billingEvery: c.billing_every as number | null,
      billingUnit: c.billing_unit as string | null,
    } : null,
    // Seis mais recentes: a tela é uma preparação de minutos, não o histórico inteiro — para isso existe a
    // aba Observações. O recorte é aqui e não no banco porque a fonte já devolve tudo ordenado.
    observacoes: obs.slice(0, 6).map(o => ({ body: o.body, createdAt: o.createdAt, autor: o.authorName })),
  }
}
