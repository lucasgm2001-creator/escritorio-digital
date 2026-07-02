import Link from 'next/link'
import type { CollaboratorCardVM } from '@/lib/people/types'
import { cn } from '@/lib/utils'
import { COLLABORATOR_STATUS, initials } from '@/lib/people/presentation'

// Card do colaborador — leva ao detalhe (Master → Detail).
export function CollaboratorCard({ collaborator, example }: { collaborator: CollaboratorCardVM; example?: boolean }) {
  const status = COLLABORATOR_STATUS[collaborator.status]
  const subtitle = [collaborator.roleName, collaborator.departmentName].filter(Boolean).join(' · ') || '—'

  return (
    <Link
      href={`/admin/colaboradores/${collaborator.id}`}
      className="bento-fx p-4 flex flex-col gap-3 hover:border-lime/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0 font-display font-bold text-sm text-lime-fg">
          {initials(collaborator.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-bento-text truncate">{collaborator.name}</span>
            {example && (
              <span className="text-[9px] font-tech uppercase tracking-wide text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">
                exemplo
              </span>
            )}
          </div>
          <p className="text-[12px] text-bento-muted truncate">{subtitle}</p>
        </div>
        <span className={cn('text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0', status.cls)}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-bento border border-bento-border p-2 min-w-0">
          <p className="text-bento-dim">Template</p>
          <p className="text-bento-text truncate mt-0.5">{collaborator.templateName ?? '—'}</p>
        </div>
        <div className="rounded-bento border border-bento-border p-2 min-w-0">
          <p className="text-bento-dim">Gestor</p>
          <p className="text-bento-text truncate mt-0.5">{collaborator.managerName ?? '—'}</p>
        </div>
      </div>
    </Link>
  )
}
