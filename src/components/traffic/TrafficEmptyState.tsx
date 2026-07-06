import Link from 'next/link'
import { Plug, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

// Estado vazio de Tráfego (UX-TRAFFIC-ENTERPRISE-001) — EmptyState ÚNICO (EXPERIENCE-001) + UMA ação
// principal: conectar conta. Toda tela vazia do módulo oferece o MESMO próximo passo (nunca "off"/inacabado).
export function TrafficEmptyState({ icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={hint}
      action={
        <Link href="/trafego/contas" className="bento-btn inline-flex items-center gap-1.5 px-4 min-h-control rounded-btn text-sm font-semibold">
          <Plug className="w-4 h-4" />Conectar conta
        </Link>
      }
    />
  )
}
