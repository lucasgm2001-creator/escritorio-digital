import type { CollaboratorCardVM, CollaboratorStatus } from '@/lib/people/types'
import { cn } from '@/lib/utils'

const STATUS: Record<CollaboratorStatus, { label: string; cls: string }> = {
  ativo:     { label: 'Ativo',     cls: 'bg-lime/15 text-lime-fg border-lime/30' },
  inativo:   { label: 'Inativo',   cls: 'bg-bento-panel/60 text-bento-dim border-bento-border' },
  convidado: { label: 'Convidado', cls: 'bg-amber-900/20 text-amber-400 border-amber-800/40' },
  afastado:  { label: 'Afastado',  cls: 'bg-bento-panel/60 text-bento-muted border-bento-border' },
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase() ?? '').join('')
}

export function CollaboratorCard({ collaborator, example }: { collaborator: CollaboratorCardVM; example?: boolean }) {
  const status = STATUS[collaborator.status]
  const subtitle = [collaborator.roleName, collaborator.departmentName].filter(Boolean).join(' · ') || '—'

  return (
    <div className="bento-fx p-4 flex flex-col gap-3">
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
    </div>
  )
}
