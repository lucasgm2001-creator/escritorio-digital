'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, LogOut, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { switchTeamAction, leaveTeamAction } from './team-actions'

export type TeamAccessTeam = { id: string; name: string; role: string }
export type TeamAccessMember = { userId: string; role: 'owner' | 'admin' | 'member'; joinedAt: string | null; name: string }

// Espelha pickSuccessor do servidor — SÓ para preview no diálogo (o servidor é a autoridade da sucessão).
const RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 }
function previewSuccessor(members: TeamAccessMember[], currentUserId: string): TeamAccessMember | null {
  const others = members.filter(m => m.userId !== currentUserId)
  if (others.length === 0) return null
  return [...others].sort((a, b) => {
    const r = (RANK[a.role] ?? 9) - (RANK[b.role] ?? 9)
    if (r !== 0) return r
    const ca = a.joinedAt ?? '9999-12-31T23:59:59Z'
    const cb = b.joinedAt ?? '9999-12-31T23:59:59Z'
    if (ca !== cb) return ca < cb ? -1 : 1
    return a.userId < b.userId ? -1 : 1
  })[0]
}

// Controles de ACESSO à equipe (qualquer membro): trocar equipe ativa + sair com sucessão segura.
// A gestão de membros/convites (admin) fica no TeamSettingsSection; aqui é só o acesso do próprio usuário.
export function TeamAccessControls({
  teams,
  activeTeamId,
  currentUserId,
  currentRole,
  members,
}: {
  teams: TeamAccessTeam[]
  activeTeamId: string
  currentUserId: string
  currentRole: 'owner' | 'admin' | 'member'
  members: TeamAccessMember[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isOwner = currentRole === 'owner'
  const successor = useMemo(() => previewSuccessor(members, currentUserId), [members, currentUserId])
  const soleOwnerBlocked = isOwner && !successor
  const currentTeamName = teams.find(t => t.id === activeTeamId)?.name ?? 'esta equipe'

  const onSwitch = (teamId: string) => {
    if (teamId === activeTeamId || pending) return
    setMessage(null)
    startTransition(async () => {
      const res = await switchTeamAction(teamId)
      if (!res.ok) { setMessage({ type: 'error', text: res.error }); return }
      // "Equipe alterada com sucesso." — recarrega no Hall já com a nova equipe ativa (novo cookie).
      router.push('/hall')
      router.refresh()
    })
  }

  const onLeave = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await leaveTeamAction()
      if (!res.ok) { setConfirming(false); setMessage({ type: 'error', text: res.error }); return }
      router.push(res.data.redirectTo)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {/* Trocar equipe — só aparece o seletor quando o usuário faz parte de mais de uma equipe (Part 6). */}
      {teams.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-bento-muted flex-wrap">
          <ArrowLeftRight className="w-3.5 h-3.5 text-lime-fg shrink-0" /> Trocar equipe
          <select
            value={activeTeamId}
            disabled={pending}
            onChange={e => onSwitch(e.target.value)}
            className="bg-bento-bg border border-bento-border rounded-btn px-2 py-1.5 text-xs text-bento-text focus:outline-none focus:border-lime disabled:opacity-50"
          >
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}

      {message && (
        <p className={cn(
          'text-xs rounded-btn border px-3 py-2',
          message.type === 'success' ? 'bg-lime/10 border-lime/30 text-lime-fg' : 'bg-red-400/10 border-red-400/30 text-red-400',
        )}>
          {message.text}
        </p>
      )}

      {/* Sair da equipe — botão discreto → confirmação forte, com o sucessor quando o usuário é owner. */}
      {!confirming ? (
        <button
          type="button"
          onClick={() => { setMessage(null); setConfirming(true) }}
          className="inline-flex items-center gap-1.5 text-xs text-bento-dim hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair da equipe
        </button>
      ) : (
        <div className="rounded-bento border border-red-800/40 bg-red-900/15 p-3 space-y-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-bento-text">Sair de {currentTeamName}?</p>
              {soleOwnerBlocked ? (
                <p className="text-xs text-red-400">
                  Você é o único owner e único membro desta equipe. Convide ou promova outra pessoa antes de sair.
                </p>
              ) : isOwner && successor ? (
                <p className="text-xs text-bento-muted">
                  Você perde o acesso a esta equipe. Como você é owner,{' '}
                  <strong className="text-bento-text">{successor.name}</strong> será promovido a owner automaticamente.
                </p>
              ) : (
                <p className="text-xs text-bento-muted">
                  Você perde o acesso a esta equipe. Poderá voltar depois com um novo convite.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLeave}
              disabled={pending || soleOwnerBlocked}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-btn text-xs font-semibold bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 disabled:opacity-50 min-h-[40px]"
            >
              <LogOut className="w-3.5 h-3.5" /> {pending ? 'Saindo...' : 'Confirmar saída'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="px-3 py-2 rounded-btn text-xs border border-bento-border text-bento-dim hover:text-bento-text transition-colors disabled:opacity-50 min-h-[40px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
