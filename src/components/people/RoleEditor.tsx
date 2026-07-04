'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCollaboratorRoleAction } from '@/app/admin/people-actions'
import { ROLE_CATALOG, DEPARTMENT_CATALOG } from '@/lib/people/catalog'

// Alteração de CARGO pelo owner/admin (PEOPLE-002A, Part 4/5). Dropdown alimentado EXCLUSIVAMENTE pelo catálogo
// oficial, agrupado por departamento. Salvar → server action (autoridade no servidor). O departamento é
// preenchido automaticamente pelo cargo no servidor. Estados honestos; nada client-direct.
const inputCls = 'w-full sm:max-w-xs bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime'

export function RoleEditor({ userId, currentRoleKey }: { userId: string; currentRoleKey: string | null }) {
  const router = useRouter()
  const [roleKey, setRoleKey] = useState<string>(currentRoleKey ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = (roleKey || null) !== (currentRoleKey || null)

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    const res = await updateCollaboratorRoleAction({ userId, roleKey: roleKey || null })
    setSaving(false)
    if (res.ok) { setSaved(true); router.refresh() }
    else setError(res.error)
  }

  return (
    <div className="space-y-2 pt-3 border-t border-bento-border">
      <label htmlFor="role-select" className="text-[12px] font-tech uppercase tracking-wide text-bento-muted">Alterar cargo</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <select id="role-select" value={roleKey} onChange={e => { setRoleKey(e.target.value); setSaved(false) }} className={inputCls}>
          <option value="">Não configurado</option>
          {DEPARTMENT_CATALOG.map(d => {
            const roles = ROLE_CATALOG.filter(r => r.department === d.key)
            if (roles.length === 0) return null
            return (
              <optgroup key={d.key} label={d.name}>
                {roles.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}
              </optgroup>
            )
          })}
        </select>
        <button
          type="button" onClick={save} disabled={saving || !dirty}
          className="bento-btn px-4 min-h-[40px] rounded-btn text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      <p className="text-[11px] text-bento-dim">O departamento é preenchido automaticamente pelo cargo.</p>
      {error && <p className="text-[12px] text-red-400">{error}</p>}
      {saved && !error && <p className="text-[12px] text-emerald-400">Cargo atualizado.</p>}
    </div>
  )
}
