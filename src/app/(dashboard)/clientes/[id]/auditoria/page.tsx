import { notFound } from 'next/navigation'
import { getClientSection } from '@/lib/client/sections'
import { DomainSectionView } from '@/components/domain/DomainSectionView'

export default function Page() {
  const section = getClientSection('auditoria')
  if (!section) notFound()
  return <DomainSectionView section={section} />
}
