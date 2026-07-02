import Link from 'next/link'
import { ChevronLeft, Briefcase, FolderOpen, Wallet, Users, UserPlus, ShieldCheck } from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import { CompensationFlow } from '@/components/admin/CompensationFlow'
import type { CollaboratorDetailVM } from '@/lib/people/types'
import { cn } from '@/lib/utils'
import { COLLABORATOR_STATUS, initials } from '@/lib/people/presentation'
import { InfoTile } from './InfoTile'

// Detalhe do colaborador — o "centro da gestão de pessoas" (Master → Detail). Prepara VISUALMENTE
// foto, cargo, departamento, template, gestor, equipe, status, permissões e remuneração. Sem cálculo.
export function CollaboratorDetail({ collaborator, teamName }: { collaborator: CollaboratorDetailVM; teamName: string | null }) {
  const status = COLLABORATOR_STATUS[collaborator.status]
  const subtitle = [collaborator.roleName, collaborator.departmentName].filter(Boolean).join(' · ') || '—'

  return (
    <div className="space-y-6 md:space-y-7">
      <Link href="/admin/colaboradores" className="md:hidden inline-flex items-center gap-1 text-sm text-bento-muted min-h-[44px]">
        <ChevronLeft className="w-4 h-4" /> Colaboradores
      </Link>

      <header className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0 font-display font-bold text-xl text-lime-fg">
          {initials(collaborator.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl text-bento-text truncate">{collaborator.name}</h1>
            <span className={cn('text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border', status.cls)}>{status.label}</span>
            <span className="text-[9px] font-tech uppercase tracking-wide text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5">exemplo</span>
          </div>
          <p className="text-sm text-bento-muted mt-1">{subtitle}</p>
          {collaborator.email && <p className="text-[12px] text-bento-dim mt-0.5 truncate">{collaborator.email}</p>}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <InfoTile icon={Briefcase} label="Cargo" value={collaborator.roleName ?? '—'} />
        <InfoTile icon={FolderOpen} label="Departamento" value={collaborator.departmentName ?? '—'} />
        <InfoTile icon={Wallet} label="Template" value={collaborator.templateName ?? '—'} />
        <InfoTile icon={UserPlus} label="Gestor" value={collaborator.managerName ?? '—'} />
        <InfoTile icon={Users} label="Equipe" value={teamName ?? '—'} />
        <InfoTile icon={ShieldCheck} label="Status" value={status.label} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Panel label="Permissões">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-bento-dim mt-0.5 shrink-0" />
            <p className="text-[13px] text-bento-muted leading-relaxed">
              Acesso definido pelo papel na equipe (Owner/Admin/Manager/Member). A configuração granular por
              módulo chega no PERMISSION-001.
            </p>
          </div>
        </Panel>
        <Panel label="Remuneração (resumo)">
          <div className="flex items-start gap-2.5">
            <Wallet className="w-4 h-4 text-bento-dim mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] text-bento-text">
                Template: <span className="text-bento-muted">{collaborator.templateName ?? 'sem template'}</span>
              </p>
              <p className="text-[12px] text-bento-muted leading-relaxed mt-1">
                Cálculo, limites e histórico chegam no COMPENSATION-001. Nada é calculado nesta fase.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel label="Como a remuneração funciona">
        <CompensationFlow />
      </Panel>

      <p className="text-[11px] text-bento-dim">Colaborador de exemplo — a gestão real chega nas próximas fases.</p>
    </div>
  )
}
