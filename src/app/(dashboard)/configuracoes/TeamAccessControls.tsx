'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, LogOut, ShieldAlert, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_TEAMS_PER_USER, hasReachedTeamLimit } from '@/lib/teams/limits'
import { switchTeamAction, leaveTeamAction, redeemInviteAction } from './team-actions'

export type TeamAccessTeam = { id: string; name: string; role: string }
export type TeamAccessMember = { userId: string; role: 'owner' | 'admin' | 'member'; joinedAt: string | null; name: string }

// Espelha pickSuccessor do servidor — SÓ para preview no diálogo (o servidor é a autoridade da sucessão).
const RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 }
const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }

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

// Controles de ACESSO à equipe (qualquer membro): lista das equipes + trocar a ativa + entrar em outra por
// convite (limite de 4) + sair com confirmação forte e sucessão segura. A gestão de membros/convites (admin)
// fica no TeamSettingsSection; aqui é só o acesso do próprio usuário.
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
  const [inviteCode, setInviteCode] = useState('')
  const [confirmText, setConfirmText] = useState('')   // digitar o nome da equipe para confirmar a saída

  const isOwner = currentRole === 'owner'
  const successor = useMemo(() => previewSuccessor(members, currentUserId), [members, currentUserId])
  const soleOwnerBlocked = isOwner && !successor
  const currentTeamName = teams.find(t => t.id === activeTeamId)?.name ?? 'esta equipe'
  const atLimit = hasReachedTeamLimit(teams.length)

  const onSwitch = (teamId: string) => {
    if (teamId === activeTeamId || pending) return
    setMessage(null)
    startTransition(async () => {
      const res = await switchTeamAction(teamId)
      if (!res.ok) { setMessage({ type: 'error', text: res.error }); return }
      router.push('/mesa')   // "Equipe alterada" — recarrega a mesa já com a nova equipe ativa (novo cookie).
      router.refresh()
    })
  }

  const onRedeem = () => {
    const code = inviteCode.trim()
    if (!code || pending) return
    setMessage(null)
    startTransition(async () => {
      const res = await redeemInviteAction(code)
      if (!res.ok) { setMessage({ type: 'error', text: res.error }); return }
      setInviteCode('')
      setMessage({ type: 'success', text: res.data.message })
      router.refresh()   // a nova equipe aparece na lista sem trocar a ativa (aditivo)
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
    <div className="space-y-4">
      {/* Suas equipes — lista com papel, indicador de ativa e "Usar esta equipe" (Part 4). */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Suas equipes</p>
          <span className="font-tech text-[10px] text-bento-dim tabular-nums">{teams.length}/{MAX_TEAMS_PER_USER} equipes</span>
        </div>
        <div className="space-y-1.5">
          {teams.map(t => {
            const active = t.id === activeTeamId
            return (
              <div key={t.id} className={cn('flex items-center justify-between gap-2 rounded-bento border px-3 py-2', active ? 'border-lime/40 bg-lime/5' : 'border-bento-border')}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-bento-text truncate flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-bento-dim shrink-0" />
                    <span className="truncate">{t.name}</span>
                    {active && <span className="font-tech text-[10px] uppercase tracking-wide text-lime-fg border border-lime/40 rounded-full px-1.5 py-px shrink-0">Ativa</span>}
                  </p>
                  <p className="text-[11px] text-bento-muted mt-0.5 pl-5">{ROLE_LABEL[t.role] ?? t.role}</p>
                </div>
                {active ? (
                  <span className="text-[11px] text-lime-fg font-medium shrink-0">Em uso</span>
                ) : (
                  <button type="button" onClick={() => onSwitch(t.id)} disabled={pending}
                    className="shrink-0 px-3 min-h-[40px] rounded-btn text-xs font-semibold border border-bento-border text-bento-text hover:border-lime hover:text-lime-fg transition-colors disabled:opacity-50">
                    Usar esta equipe
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Entrar em outra equipe por convite (Part 3) — respeita o limite de 4 (Part 2). */}
      {atLimit ? (
        <p className="text-[11px] text-bento-muted">Você atingiu o limite de {MAX_TEAMS_PER_USER} equipes. Saia de uma para entrar em outra.</p>
      ) : (
        <div>
          <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-1.5">Entrar em outra equipe</p>
          <div className="flex items-center gap-2">
            <input
              value={inviteCode}
              onChange={e => { setInviteCode(e.target.value); if (message) setMessage(null) }}
              onKeyDown={e => { if (e.key === 'Enter') onRedeem() }}
              disabled={pending}
              placeholder="Cole o código do convite"
              className="flex-1 min-w-0 bg-bento-bg border border-bento-border rounded-btn px-3 min-h-[40px] text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime disabled:opacity-50"
            />
            <button type="button" onClick={onRedeem} disabled={pending || !inviteCode.trim()}
              className="bento-btn inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-btn text-xs font-semibold shrink-0 disabled:opacity-50">
              <Ticket className="w-3.5 h-3.5" /> Entrar
            </button>
          </div>
        </div>
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
          onClick={() => { setMessage(null); setConfirmText(''); setConfirming(true) }}
          className="inline-flex items-center gap-1.5 text-xs text-bento-dim hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair desta equipe
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
          {/* Ação crítica: digitar o nome da equipe para liberar o botão (Part 5). */}
          {!soleOwnerBlocked && (
            <div>
              <label className="block text-[11px] text-bento-muted mb-1">
                Para confirmar, digite <strong className="text-bento-text">{currentTeamName}</strong>
              </label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                disabled={pending}
                placeholder={currentTeamName}
                className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 min-h-[40px] text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-red-500/50 disabled:opacity-50"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLeave}
              disabled={pending || soleOwnerBlocked || confirmText.trim() !== currentTeamName}
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
