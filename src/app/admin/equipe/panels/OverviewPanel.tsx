import { Users, ShieldCheck, Ticket, Building2 } from 'lucide-react'
import { MetricCard } from '@/components/ui/MetricCard'
import { ROLE_LABEL, type WorkspaceRole } from '../shared'

type Props = {
  teamName: string | null
  currentRole: WorkspaceRole
  memberCount: number
  adminCount: number
  pendingInvites: number
  teamCount: number
  ownerName: string | null
}

// Aba VISÃO GERAL do Workspace Center (Part 1). Panorama do workspace ativo: indicadores + resumo. Sem
// cálculo de regra de negócio — só agrega o que os outros painéis já mostram.
export function OverviewPanel({ teamName, currentRole, memberCount, adminCount, pendingInvites, teamCount, ownerName }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Membros" value={memberCount} size="lg" icon={<Users />} />
        <MetricCard title="Admins" value={adminCount} size="lg" tone="blue" icon={<ShieldCheck />} />
        <MetricCard title="Convites ativos" value={pendingInvites} size="lg" tone="lime" icon={<Ticket />} />
        <MetricCard title="Suas equipes" value={teamCount} size="lg" tone="muted" icon={<Building2 />} />
      </div>

      <div className="rounded-bento border border-bento-border bg-bento-surface/40 p-5 sm:p-6">
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-4">Resumo do workspace</p>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div className="space-y-0.5">
            <dt className="text-[12px] text-bento-dim">Workspace ativo</dt>
            <dd className="text-bento-text font-medium truncate">{teamName ?? '—'}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-[12px] text-bento-dim">Owner</dt>
            <dd className="text-bento-text font-medium truncate">{ownerName ?? '—'}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-[12px] text-bento-dim">Seu papel</dt>
            <dd className="text-bento-text font-medium">{ROLE_LABEL[currentRole]}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
