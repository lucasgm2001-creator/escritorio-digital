'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { updateCollaboratorRolesAction } from '@/app/admin/people-actions'
import { ROLE_CATALOG, DEPARTMENT_CATALOG, roleByKey } from '@/lib/people/catalog'

// Gestão de CARGOS (MÚLTIPLOS) pelo Owner/Desenvolvedor (ACCESS-ROLES-001). Adiciona/remove cargos do catálogo
// oficial (agrupado por departamento). Salvar → server action (autoridade no servidor: canAccessAdmin). FONTE
// ÚNICA = team_members.role_keys; sem texto livre; sem 2ª fonte. O 1º cargo é o primário (define o departamento).
const inputCls = 'w-full sm:max-w-xs bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime'

export function RoleEditor({ userId, currentRoleKeys }: { userId: string; currentRoleKeys: string[] }) {
  const router = useRouter()
  const [keys, setKeys] = useState<string[]>(currentRoleKeys)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = keys.join(',') !== currentRoleKeys.join(',')
  const add = (k: string) => { if (k && !keys.includes(k)) { setKeys([...keys, k]); setSaved(false) } }
  const remove = (k: string) => { setKeys(keys.filter(x => x !== k)); setSaved(false) }

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    const res = await updateCollaboratorRolesAction({ userId, roleKeys: keys })
    setSaving(false)
    if (res.ok) { setSaved(true); router.refresh() } else setError(res.error)
  }

  return (
    <div className="space-y-2 pt-3 border-t border-bento-border">
      <label className="text-[12px] font-tech uppercase tracking-wide text-bento-muted">Cargos do colaborador</label>
      <div className="flex flex-wrap gap-1.5">
        {keys.length === 0 ? <span className="text-[12px] text-bento-dim">Nenhum cargo.</span> : keys.map((k, i) => (
          <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-bento-border bg-bento-panel text-[11px] font-tech uppercase tracking-wide text-bento-text">
            {roleByKey(k)?.name ?? k}{i === 0 && <span className="text-bento-dim normal-case tracking-normal">· primário</span>}
            <button type="button" onClick={() => remove(k)} aria-label="Remover cargo" className="text-bento-muted hover:text-red-400"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <select value="" onChange={e => add(e.target.value)} className={inputCls}>
          <option value="">+ Adicionar cargo…</option>
          {DEPARTMENT_CATALOG.map(d => {
            const roles = ROLE_CATALOG.filter(r => r.department === d.key && !keys.includes(r.key))
            if (roles.length === 0) return null
            return <optgroup key={d.key} label={d.name}>{roles.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}</optgroup>
          })}
        </select>
        <button type="button" onClick={save} disabled={saving || !dirty}
          className="bento-btn px-4 min-h-[40px] rounded-btn text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      <p className="text-[11px] text-bento-dim">O 1º cargo é o primário (define o departamento). Só Owner/Desenvolvedor.</p>
      {error && <p className="text-[12px] text-red-400">{error}</p>}
      {saved && !error && <p className="text-[12px] text-emerald-400">Cargos atualizados.</p>}
    </div>
  )
}
