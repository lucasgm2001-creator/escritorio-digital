import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { CompanyProfileForm } from './CompanyProfileForm'
import type { CompanyProfileInput } from './actions'

export default async function Page() {
  const context = await getRequestContext()
  if (!context) return null
  requireAdminManage(context)

  const supabase = createClient()
  const { data, error } = await supabase.from('teams').select(`
    name, legal_name, tax_id, industry, description, motto, mission, vision,
    company_values, website, contact_email, contact_phone, address_line,
    city, state, postal_code, country, timezone, currency, locale
  `).eq('id', context.activeTeamId!).single()
  if (error) throw error

  const profile: CompanyProfileInput = {
    name: data.name ?? '', legalName: data.legal_name ?? '', taxId: data.tax_id ?? '',
    industry: data.industry ?? '', description: data.description ?? '', motto: data.motto ?? '',
    mission: data.mission ?? '', vision: data.vision ?? '', values: Array.isArray(data.company_values) ? data.company_values : [],
    website: data.website ?? '', contactEmail: data.contact_email ?? '', contactPhone: data.contact_phone ?? '',
    addressLine: data.address_line ?? '', city: data.city ?? '', state: data.state ?? '', postalCode: data.postal_code ?? '',
    country: data.country ?? 'Brasil', timezone: data.timezone ?? 'America/Sao_Paulo',
    currency: data.currency ?? 'USD', locale: data.locale ?? 'pt-BR',
  }

  return <div className="space-y-6">
    <WorkspaceHeader breadcrumb={['Administração', 'Empresa']} title="Empresa" subtitle="Identidade, cultura, contato e preferências da empresa ativa." />
    <CompanyProfileForm initial={profile} canEdit={context.role === 'owner'} />
  </div>
}
