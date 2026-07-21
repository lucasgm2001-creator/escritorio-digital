'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'

export type CompanyProfileInput = {
  name: string; legalName: string; taxId: string; industry: string; description: string
  motto: string; mission: string; vision: string; values: string[]; website: string
  contactEmail: string; contactPhone: string; addressLine: string; city: string; state: string
  postalCode: string; country: string; timezone: string; currency: string; locale: string
}
type ActionResult = { ok: true } | { ok: false; error: string }

const LIMITS: Partial<Record<keyof CompanyProfileInput, number>> = {
  name: 120, legalName: 180, taxId: 40, industry: 100, description: 1200,
  motto: 240, mission: 800, vision: 800, website: 300, contactEmail: 254,
  contactPhone: 40, addressLine: 240, city: 100, state: 100, postalCode: 24,
  country: 100, timezone: 80, currency: 3, locale: 20,
}
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export async function updateCompanyProfileAction(input: CompanyProfileInput): Promise<ActionResult> {
  const context = await getRequestContext()
  if (!context) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
  if (!context.activeTeamId) return { ok: false, error: 'Nenhuma empresa ativa.' }
  if (context.role !== 'owner' || context.membership?.team_id !== context.activeTeamId) {
    return { ok: false, error: 'Somente o owner desta empresa pode alterar esses dados.' }
  }
  if (!input || typeof input !== 'object') return { ok: false, error: 'Dados da empresa inválidos.' }

  const normalized = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value : clean(value)])) as CompanyProfileInput
  if (normalized.name.length < 2) return { ok: false, error: 'Informe um nome com ao menos 2 caracteres.' }
  for (const [key, max] of Object.entries(LIMITS) as [keyof CompanyProfileInput, number][]) {
    const value = normalized[key]
    if (typeof value === 'string' && value.length > max) return { ok: false, error: `O campo ${key} ultrapassa o limite de ${max} caracteres.` }
  }
  if (normalized.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.contactEmail)) return { ok: false, error: 'Informe um e-mail válido.' }
  if (!['USD', 'BRL', 'EUR'].includes(normalized.currency)) return { ok: false, error: 'Selecione uma moeda válida.' }
  if (!['pt-BR', 'en-US', 'es-ES'].includes(normalized.locale)) return { ok: false, error: 'Selecione um idioma válido.' }
  if (!['America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'].includes(normalized.timezone)) return { ok: false, error: 'Selecione um fuso horário válido.' }
  if (normalized.website) {
    try {
      const url = new URL(normalized.website)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol')
    } catch { return { ok: false, error: 'Informe o site completo, começando com http:// ou https://.' } }
  }

  const values = [...new Set((normalized.values ?? []).map(clean).filter(Boolean))]
  if (values.length > 20) return { ok: false, error: 'Informe no máximo 20 valores da empresa.' }
  if (values.some(value => value.length > 100)) return { ok: false, error: 'Cada valor da empresa pode ter no máximo 100 caracteres.' }

  const supabase = createClient()
  const { error } = await supabase.rpc('update_team_company_profile', {
    p_team_id: context.activeTeamId, p_name: normalized.name, p_legal_name: normalized.legalName,
    p_tax_id: normalized.taxId, p_industry: normalized.industry, p_description: normalized.description,
    p_motto: normalized.motto, p_mission: normalized.mission, p_vision: normalized.vision,
    p_company_values: values, p_website: normalized.website, p_contact_email: normalized.contactEmail,
    p_contact_phone: normalized.contactPhone, p_address_line: normalized.addressLine, p_city: normalized.city,
    p_state: normalized.state, p_postal_code: normalized.postalCode, p_country: normalized.country,
    p_timezone: normalized.timezone, p_currency: normalized.currency, p_locale: normalized.locale,
  })
  if (error) {
    console.error('[company-profile] update failed', { code: error.code, teamId: context.activeTeamId })
    return { ok: false, error: error.code === '42501' ? 'Somente o owner pode alterar a empresa.' : 'Não foi possível salvar os dados da empresa.' }
  }

  revalidatePath('/admin/empresa'); revalidatePath('/admin/equipe'); revalidatePath('/hall')
  return { ok: true }
}
