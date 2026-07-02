import 'server-only'

import { createClient } from '@/lib/supabase/server'

// Data Access Layer puro para as configuracoes de remuneracao por colaborador
// (tabela collaborator_compensation_settings, migration 040). APENAS leitura de
// dados: regras de negocio, calculo de comissao, permissoes e efeitos colaterais
// pertencem ao CompensationService (ARCH-001), NAO a este repository.

export type CommissionType = 'percentage' | 'fixed'
export type UpgradeCommissionBase = 'full_value' | 'plan_difference'
export type PaymentRule = 'weekly_as_client_pays' | 'next_month_after_completion'

export type CompensationSettings = {
  id: string
  team_id: string | null
  seller_id: string
  fixed_salary_enabled: boolean
  fixed_salary_monthly_usd: number
  contract_commission_enabled: boolean
  contract_commission_type: CommissionType
  contract_commission_value: number
  meeting_commission_enabled: boolean
  meeting_commission_type: CommissionType
  meeting_commission_value: number
  renewal_bonus_enabled: boolean
  renewal_bonus_type: CommissionType
  renewal_bonus_value: number
  upgrade_commission_enabled: boolean
  upgrade_commission_type: CommissionType
  upgrade_commission_value: number
  upgrade_commission_base: UpgradeCommissionBase
  payment_rule: PaymentRule
  effective_from: string
  created_at: string | null
  updated_at: string | null
}

const COLUMNS =
  'id, team_id, seller_id, ' +
  'fixed_salary_enabled, fixed_salary_monthly_usd, ' +
  'contract_commission_enabled, contract_commission_type, contract_commission_value, ' +
  'meeting_commission_enabled, meeting_commission_type, meeting_commission_value, ' +
  'renewal_bonus_enabled, renewal_bonus_type, renewal_bonus_value, ' +
  'upgrade_commission_enabled, upgrade_commission_type, upgrade_commission_value, upgrade_commission_base, ' +
  'payment_rule, effective_from, created_at, updated_at'

// Todas as vigencias de um vendedor, da mais recente para a mais antiga.
export async function getCompensationSettingsBySellerId(
  sellerId: string,
): Promise<CompensationSettings[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('collaborator_compensation_settings')
    .select(COLUMNS)
    .eq('seller_id', sellerId)
    .order('effective_from', { ascending: false })

  if (error) throw error

  return (data ?? []) as unknown as CompensationSettings[]
}

// Config vigente de um vendedor numa data: a linha de maior effective_from <= date.
// `date` = data ISO (YYYY-MM-DD). Apenas seleciona a linha aplicavel; nao calcula nada.
export async function getActiveCompensationSettings(
  sellerId: string,
  date: string,
): Promise<CompensationSettings | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('collaborator_compensation_settings')
    .select(COLUMNS)
    .eq('seller_id', sellerId)
    .lte('effective_from', date)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data as CompensationSettings | null
}

// Todas as configuracoes de uma equipe (todas as vigencias, todos os vendedores).
export async function getCompensationSettingsByTeam(
  teamId: string,
): Promise<CompensationSettings[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('collaborator_compensation_settings')
    .select(COLUMNS)
    .eq('team_id', teamId)
    .order('effective_from', { ascending: false })

  if (error) throw error

  return (data ?? []) as unknown as CompensationSettings[]
}
