import Link from 'next/link'
import type { CollaboratorCardVM } from '@/lib/people/types'
import { cn } from '@/lib/utils'
import { COLLABORATOR_STATUS, TEAM_ROLE_BADGE, formatJoinedAt, initials } from '@/lib/people/presentation'

// Card do colaborador REAL (team_members + profiles) — leva ao detalhe (Master → Detail). Papel de acesso e
// data de entrada são reais; cargo ainda não persistido no RH → honesto ("Não configurado"). Foto: iniciais
// (avatarUrl fica no VM, pronto para next/image quando o domínio de storage for configurado).
export function CollaboratorCard({ collaborator }: { collaborator: CollaboratorCardVM }) {
  const status = COLLABORATOR_STATUS[collaborator.status]
  const role = TEAM_ROLE_BADGE[collaborator.teamRole]

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
            <span className={cn('text-[10px] font-tech uppercase tracking-wide px-1.5 py-0.5 rounded-full border shrink-0', role.cls)}>
              {role.label}
            </span>
          </div>
          <p className="text-[12px] text-bento-muted truncate">{collaborator.email ?? 'Sem email'}</p>
        </div>
        <span className={cn('text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0', status.cls)}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-bento border border-bento-border p-2 min-w-0">
          <p className="text-bento-dim">Cargo</p>
          <p className="text-bento-text truncate mt-0.5">{collaborator.roleName ?? 'Não configurado'}</p>
        </div>
        <div className="rounded-bento border border-bento-border p-2 min-w-0">
          <p className="text-bento-dim">Entrada</p>
          <p className="text-bento-text truncate mt-0.5">{formatJoinedAt(collaborator.joinedAt)}</p>
        </div>
      </div>
    </Link>
  )
}
