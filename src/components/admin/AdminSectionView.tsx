import { notFound } from 'next/navigation'
import { getDomainSection } from '@/lib/domain/registry'
import type { AdminSectionKey } from '@/lib/admin/sections'
import { DomainSectionView } from '@/components/domain/DomainSectionView'

// Cartão de módulo da Administração — delega para o cartão GENÉRICO de domínio (roadmap). O guard owner/dev
// (requireAdminManage) fica na PÁGINA de cada seção (CLIENT-HISTORY-ADMIN-003), como nas demais — este componente
// segue puro/síncrono (evita aninhar async server component em página síncrona).
export function AdminSectionView({ sectionKey }: { sectionKey: AdminSectionKey }) {
  const section = getDomainSection('admin', sectionKey)
  if (!section) notFound()
  return <DomainSectionView section={section} />
}
