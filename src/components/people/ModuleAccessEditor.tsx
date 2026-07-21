'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ModuleAccessRow } from '@/lib/people/types'
import type { ModuleLevel } from '@/lib/permissions/types'
import { MODULE_LEVELS } from '@/lib/permissions/levels'
import { MODULE_LEVEL_BADGE } from '@/lib/people/presentation'
import { setMemberModuleLevelAction } from '@/app/admin/colaboradores/permission-actions'
import { cn } from '@/lib/utils'

// Editor de acesso por módulo — CLIENTE da arquitetura (PERMISSIONS-002). A autoridade é o servidor: cada
// mudança chama a action (owner-only, validada) e o perfil recompõe a matriz efetiva. Quando não editável,
// mostra só os níveis efetivos (badges). NUNCA decide acesso aqui — só exibe/solicita.
export function ModuleAccessEditor({ userId, rows, editable }: { userId: string; rows: ModuleAccessRow[]; editable: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onChange(moduleKey: string, level: ModuleLevel) {
    setError(null)
    setBusyKey(moduleKey)
    startTransition(async () => {
      const res = await setMemberModuleLevelAction(userId, moduleKey, level)
      if (!res.ok) setError(res.error)
      else router.refresh()
      setBusyKey(null)
    })
  }

  return (
    <div>
      <ul className="-my-1 divide-y divide-bento-border">
        {rows.map(row => {
          const lvl = MODULE_LEVEL_BADGE[row.level]
          return (
            <li key={row.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 flex items-center gap-2">
                <span className="text-sm text-bento-text truncate">{row.label}</span>
                {row.overridden && (
                  <span className="text-[10px] font-tech uppercase tracking-wide text-lime-fg/70 shrink-0">personalizado</span>
                )}
              </span>
              {editable ? (
                <select
                  value={row.level}
                  disabled={pending && busyKey === row.key}
                  onChange={e => onChange(row.key, e.target.value as ModuleLevel)}
                  aria-label={`Nível de acesso — ${row.label}`}
                  className="shrink-0 text-[12px] rounded-btn border border-bento-border bg-bento-panel text-bento-text px-2 py-1 outline-none focus:border-lime/40 disabled:opacity-50"
                >
                  {MODULE_LEVELS.map(l => (
                    <option key={l} value={l}>{MODULE_LEVEL_BADGE[l].label}</option>
                  ))}
                </select>
              ) : (
                <span className={cn('text-[10px] font-tech uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0', lvl.cls)}>
                  {lvl.label}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}
    </div>
  )
}
