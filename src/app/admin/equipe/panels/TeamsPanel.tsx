'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, LogIn, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { switchTeamAction } from '@/app/(dashboard)/configuracoes/team-actions'
import { ROLE_LABEL, ROLE_BADGE, initialsOf, type WorkspaceRole } from '../shared'

export type WorkspaceTeam = {
  id: string
  name: string
  role: WorkspaceRole
  memberCount: number
  isActive: boolean
}

// Aba EQUIPES do Workspace Center (Part 4) — seletor premium (Slack/Linear/Meta Business): cada workspace
// mostra nome, papel, se você administra, nº de membros e a equipe ativa; "Entrar" alterna. Reusa
// switchTeamAction (valida o pertencimento no servidor). A saída/entrada por convite fica no self-service.
export function TeamsPanel({ teams }: { teams: WorkspaceTeam[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const enter = (id: string, isActive: boolean) => {
    if (isActive || pending) return
    setError(null); setBusyId(id)
    startTransition(async () => {
      const res = await switchTeamAction(id)
      setBusyId(null)
      if (!res.ok) { setError(res.error); return }
      router.push('/mesa'); router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-bento-muted">{teams.length} {teams.length === 1 ? 'equipe' : 'equipes'}. Entre em uma para torná-la a equipe ativa.</p>
      {error && <p className="text-xs rounded-btn border bg-red-400/10 border-red-400/30 text-red-400 px-3 py-2">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {teams.map(t => {
          const manages = t.role === 'owner' || t.role === 'admin'
          const busy = busyId === t.id
          return (
            <div key={t.id} className={cn('rounded-bento border p-5 flex items-center gap-4', t.isActive ? 'border-lime/40 bg-lime/5' : 'border-bento-border bg-bento-surface/40')}>
              <span aria-hidden className="grid place-items-center w-12 h-12 rounded-bento bg-bento-bg border border-bento-border text-sm font-display font-bold text-bento-dim shrink-0">
                {initialsOf(t.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[15px] font-semibold text-bento-text truncate">{t.name}</p>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-tech uppercase tracking-wide', ROLE_BADGE[t.role])}>
                    {ROLE_LABEL[t.role]}
                  </span>
                </div>
                <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-bento-muted">
                  <Users className="w-3.5 h-3.5" /> {t.memberCount} {t.memberCount === 1 ? 'membro' : 'membros'}
                  {manages && <span className="text-bento-dim">· você administra</span>}
                </p>
              </div>
              {t.isActive ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-fg shrink-0">
                  <Check className="w-4 h-4" /> Ativa
                </span>
              ) : (
                <button type="button" onClick={() => enter(t.id, t.isActive)} disabled={pending}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-btn text-xs font-semibold border border-bento-border text-bento-text hover:border-lime hover:text-lime-fg transition-colors disabled:opacity-50">
                  <LogIn className="w-3.5 h-3.5" /> {busy ? 'Entrando...' : 'Entrar'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
