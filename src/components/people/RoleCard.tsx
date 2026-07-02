import { Briefcase } from 'lucide-react'
import type { RoleSummary } from '@/lib/people/types'

export function RoleCard({ role }: { role: RoleSummary }) {
  return (
    <div className="bento-fx p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-bento bg-bento-panel/60 border border-bento-border flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4 text-bento-dim" />
          </div>
          <span className="font-semibold text-sm text-bento-text truncate">{role.name}</span>
        </div>
        {role.isCustom && (
          <span className="text-[10px] font-tech uppercase tracking-wide text-bento-dim border border-bento-border rounded-full px-2 py-0.5 shrink-0">
            Custom
          </span>
        )}
      </div>
      {role.description && <p className="text-[12px] text-bento-muted leading-snug">{role.description}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-bento-dim">
        <span>{role.collaboratorCount} pessoa(s)</span>
        {role.suggestedTemplateName && (
          <>
            <span className="w-1 h-1 rounded-full bg-bento-border" />
            <span>Template sugerido: <span className="text-bento-muted">{role.suggestedTemplateName}</span></span>
          </>
        )}
      </div>
    </div>
  )
}
