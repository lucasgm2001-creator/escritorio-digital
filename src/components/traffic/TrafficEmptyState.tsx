import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

// Estado vazio de Tráfego — aponta para o EmptyState ÚNICO (EXPERIENCE-001). Mantém a prop `hint` por
// compatibilidade das telas atuais; a implementação é uma só.
export function TrafficEmptyState({ icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return <EmptyState icon={icon} title={title} description={hint} />
}
