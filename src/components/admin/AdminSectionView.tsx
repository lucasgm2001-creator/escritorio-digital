import { notFound } from 'next/navigation'
import { getDomainSection } from '@/lib/domain/registry'
import type { AdminSectionKey } from '@/lib/admin/sections'
import { DomainSectionView } from '@/components/domain/DomainSectionView'

// Cartão de módulo da Administração — delega para o cartão GENÉRICO de domínio (roadmap).
export function AdminSectionView({ sectionKey }: { sectionKey: AdminSectionKey }) {
  const section = getDomainSection('admin', sectionKey)
  if (!section) notFound()
  return <DomainSectionView section={section} />
}
