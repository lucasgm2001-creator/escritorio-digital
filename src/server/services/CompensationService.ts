import 'server-only'

import type { RequestContext } from '@/server/context/request-context'
import { requireActiveTeamId } from '@/server/context/active-team'
import {
  getActiveCompensationSettings,
  type CommissionType,
  type CompensationSettings,
  type PaymentRule,
  type UpgradeCommissionBase,
} from '@/server/repositories/CompensationRepository'

/**
 * Camada de Service (ARCH-001) da remuneracao por colaborador.
 *
 *   UI / Server Actions -> CompensationService -> CompensationRepository -> Supabase
 *
 * Nesta fundacao o Service apenas LE e valida isolamento por equipe (TEAM-001) —
 * NAO calcula comissao real, NAO grava, NAO troca o calculo runtime (commission/calc.ts).
 * Como o RLS da tabela ainda esta deferido, a validacao de equipe abaixo e a unica
 * guarda de isolamento hoje.
 */

// Regra de remuneracao vigente, em formato normalizado (agrupado) para consumo futuro.
export type NormalizedCompensationRule = {
  sellerId: string
  teamId: string | null
  effectiveFrom: string
  fixedSalary: { enabled: boolean; monthlyUsd: number }
  contractCommission: { enabled: boolean; type: CommissionType; value: number }
  meetingCommission: { enabled: boolean; type: CommissionType; value: number }
  renewalBonus: { enabled: boolean; type: CommissionType; value: number }
  upgradeCommission: {
    enabled: boolean
    type: CommissionType
    value: number
    base: UpgradeCommissionBase
  }
  paymentRule: PaymentRule
}

function normalizeCompensationSettings(
  settings: CompensationSettings,
): NormalizedCompensationRule {
  return {
    sellerId: settings.seller_id,
    teamId: settings.team_id,
    effectiveFrom: settings.effective_from,
    fixedSalary: {
      enabled: settings.fixed_salary_enabled,
      monthlyUsd: settings.fixed_salary_monthly_usd,
    },
    contractCommission: {
      enabled: settings.contract_commission_enabled,
      type: settings.contract_commission_type,
      value: settings.contract_commission_value,
    },
    meetingCommission: {
      enabled: settings.meeting_commission_enabled,
      type: settings.meeting_commission_type,
      value: settings.meeting_commission_value,
    },
    renewalBonus: {
      enabled: settings.renewal_bonus_enabled,
      type: settings.renewal_bonus_type,
      value: settings.renewal_bonus_value,
    },
    upgradeCommission: {
      enabled: settings.upgrade_commission_enabled,
      type: settings.upgrade_commission_type,
      value: settings.upgrade_commission_value,
      base: settings.upgrade_commission_base,
    },
    paymentRule: settings.payment_rule,
  }
}

/**
 * Config vigente de um vendedor numa data, restrita a equipe ativa.
 * Exige equipe ativa e so retorna a config se ela pertencer a essa equipe
 * (isolamento TEAM-001); caso contrario retorna null. Nao calcula comissao.
 */
async function getActiveSettingsForSeller(
  context: RequestContext,
  sellerId: string,
  date: string,
): Promise<CompensationSettings | null> {
  const activeTeamId = requireActiveTeamId(context)

  const settings = await getActiveCompensationSettings(sellerId, date)
  if (!settings) return null

  // Isolamento por equipe: nunca expor config de outra equipe.
  if (settings.team_id !== activeTeamId) return null

  return settings
}

/**
 * Retorna a regra de remuneracao vigente ja normalizada (agrupada).
 * Apenas leitura/reshape — nao altera dados, nao grava, nao troca calculo runtime.
 */
export async function resolveCompensationRule(
  context: RequestContext,
  sellerId: string,
  date: string,
): Promise<NormalizedCompensationRule | null> {
  const settings = await getActiveSettingsForSeller(context, sellerId, date)
  if (!settings) return null

  return normalizeCompensationSettings(settings)
}
