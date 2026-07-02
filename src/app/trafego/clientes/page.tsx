import { notFound } from 'next/navigation'
import { getTrafficSection } from '@/lib/traffic/sections'
import { DomainSectionView } from '@/components/domain/DomainSectionView'

export default function Page() {
  const section = getTrafficSection('clientes')
  if (!section) notFound()
  return <DomainSectionView section={section} />
}
