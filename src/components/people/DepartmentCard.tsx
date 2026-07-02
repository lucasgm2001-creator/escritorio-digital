import { FolderOpen } from 'lucide-react'
import type { DepartmentSummary } from '@/lib/people/types'

export function DepartmentCard({ department }: { department: DepartmentSummary }) {
  return (
    <div className="bento-fx p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-bento bg-lime/10 border border-lime/20 flex items-center justify-center shrink-0">
          <FolderOpen className="w-4 h-4 text-lime-fg" />
        </div>
        <span className="font-semibold text-sm text-bento-text">{department.name}</span>
      </div>
      {department.description && <p className="text-[12px] text-bento-muted leading-snug">{department.description}</p>}
      <div className="mt-auto flex items-center gap-2.5 pt-1 text-[11px] text-bento-dim">
        <span>{department.roleCount} cargo(s)</span>
        <span className="w-1 h-1 rounded-full bg-bento-border" />
        <span>{department.collaboratorCount} pessoa(s)</span>
      </div>
    </div>
  )
}
