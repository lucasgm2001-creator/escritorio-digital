'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowDown, Check, Copy, ShieldCheck, UserPlus, XCircle } from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import { cn } from '@/lib/utils'
import { createTeamInviteAction, revokeTeamInviteAction, changeMemberRoleAction } from './team-actions'
import { TeamAccessControls, type TeamAccessTeam } from './TeamAccessControls'

export type TeamSettingsMember = {
  id: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string | null
  name: string
  email: string | null
}

export type TeamSettingsInvite = {
  id: string
  token: string | null
  expiresAt: string | null
  usedAt: string | null
  createdAt: string | null
}

type Props = {
  teamName: string | null
  members: TeamSettingsMember[]
  invites: TeamSettingsInvite[]
  // TEAM-SECURITY-001 — acesso do próprio usuário (trocar/sair) + gate da gestão (owner/admin).
  canManage?: boolean
  currentUserId: string
  currentRole: 'owner' | 'admin' | 'member'
  activeTeamId: string
  teams: TeamAccessTeam[]
}

const roleLabel: Record<TeamSettingsMember['role'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

// Iniciais para o avatar (nunca o user_id). "Ana Souza" → "AS", "gabriel" → "GA", vazio → "?".
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function isExpired(invite: TeamSettingsInvite): boolean {
  return !!invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()
}

function isPending(invite: TeamSettingsInvite): boolean {
  return !invite.usedAt && !isExpired(invite)
}

function InviteRow({
  invite,
  onCopy,
  onRevoke,
  busy,
}: {
  invite: TeamSettingsInvite
  onCopy: (token: string) => void
  onRevoke: (id: string) => void
  busy: boolean
}) {
  const pending = isPending(invite)
  const expired = isExpired(invite)
  const status = invite.usedAt ? 'Usado' : expired ? 'Expirado' : 'Pendente'

  return (
    <div className="bento-fx p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[10px] px-2 py-1 rounded-full border font-tech uppercase tracking-wide',
              pending && 'bg-lime/15 text-lime-fg border-lime/30',
              expired && 'bg-amber-900/20 text-amber-400 border-amber-800/40',
              invite.usedAt && 'bg-bento-bg text-bento-muted border-bento-border',
            )}>
              {status}
            </span>
            <span className="text-[11px] text-bento-muted">Validade: {formatDate(invite.expiresAt)}</span>
          </div>
          <p className="mt-2 font-tech text-xs text-bento-text break-all">{invite.token ?? '-'}</p>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <button
            type="button"
            onClick={() => invite.token && onCopy(invite.token)}
            disabled={!invite.token}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-btn border border-bento-border text-bento-text text-xs hover:border-lime disabled:opacity-50 min-h-[40px]"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar
          </button>
          <button
            type="button"
            onClick={() => onRevoke(invite.id)}
            disabled={busy || !!invite.usedAt}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-btn border border-bento-border text-bento-dim text-xs hover:border-red-400/60 hover:text-red-400 disabled:opacity-50 min-h-[40px]"
          >
            <XCircle className="w-3.5 h-3.5" />
            Revogar
          </button>
        </div>
      </div>
    </div>
  )
}

export function TeamSettingsSection({ teamName, members, invites: initialInvites, canManage = true, currentUserId, currentRole, activeTeamId, teams }: Props) {
  const router = useRouter()
  const [invites, setInvites] = useState(initialInvites)
  const [latestInvite, setLatestInvite] = useState<TeamSettingsInvite | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null)
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [isPendingAction, startTransition] = useTransition()

  const iAmOwner = currentRole === 'owner'

  // Promover/rebaixar — só o owner (o servidor revalida). Recarrega os dados do servidor após a mudança.
  const changeRole = (member: TeamSettingsMember, newRole: 'admin' | 'member') => {
    setMessage(null)
    setBusyMemberId(member.id)
    startTransition(async () => {
      const res = await changeMemberRoleAction(member.userId, newRole)
      setBusyMemberId(null)
      if (!res.ok) { setMessage({ type: 'error', text: res.error }); return }
      setMessage({ type: 'success', text: res.data.message })
      router.refresh()
    })
  }

  const pendingInvites = useMemo(() => invites.filter(isPending), [invites])
  const expiredInvites = useMemo(() => invites.filter(invite => !invite.usedAt && isExpired(invite)), [invites])

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      setMessage({ type: 'success', text: 'Convite copiado.' })
    } catch {
      setMessage({ type: 'error', text: 'Nao foi possivel copiar automaticamente.' })
    }
  }

  const createInvite = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await createTeamInviteAction()
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      const invite: TeamSettingsInvite = {
        id: result.data.id,
        token: result.data.token,
        expiresAt: result.data.expires_at,
        usedAt: result.data.used_at,
        createdAt: result.data.created_at,
      }
      setLatestInvite(invite)
      setInvites(current => [invite, ...current])
      setMessage({ type: 'success', text: 'Convite gerado.' })
    })
  }

  const revokeInvite = (inviteId: string) => {
    setMessage(null)
    setBusyInviteId(inviteId)
    startTransition(async () => {
      const result = await revokeTeamInviteAction(inviteId)
      setBusyInviteId(null)
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      setInvites(current => current.filter(invite => invite.id !== inviteId))
      setLatestInvite(current => current?.id === inviteId ? null : current)
      setMessage({ type: 'success', text: 'Convite revogado.' })
    })
  }

  return (
    <Panel label="Equipe e membros">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-bento-text">{teamName ?? 'Equipe ativa'}</p>
            {canManage && <p className="text-xs text-bento-muted mt-0.5">{members.length} membro(s)</p>}
          </div>
          {canManage && (
            <button
              type="button"
              onClick={createInvite}
              disabled={isPendingAction}
              className="bento-btn flex items-center justify-center gap-2 px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]"
            >
              <UserPlus className="w-4 h-4" />
              {isPendingAction && !busyInviteId ? 'Gerando...' : 'Convidar membro'}
            </button>
          )}
        </div>

        {/* Acesso do próprio usuário: trocar equipe + sair (com sucessão). Disponível a QUALQUER membro. */}
        <TeamAccessControls
          teams={teams}
          activeTeamId={activeTeamId}
          currentUserId={currentUserId}
          currentRole={currentRole}
          members={members.map(m => ({ userId: m.userId, role: m.role, joinedAt: m.joinedAt, name: m.name }))}
        />

        {/* Gestão de membros e convites — só para quem administra a equipe (owner/admin). */}
        {canManage && (<>
        {message && (
          <p className={cn(
            'text-xs rounded-btn border px-3 py-2',
            message.type === 'success'
              ? 'bg-lime/10 border-lime/30 text-lime-fg'
              : 'bg-red-400/10 border-red-400/30 text-red-400',
          )}>
            {message.text}
          </p>
        )}

        {latestInvite && (
          <div className="border border-lime/30 bg-lime/10 rounded-btn p-3">
            <div className="flex items-center gap-2 text-lime-fg">
              <Check className="w-4 h-4" />
              <p className="text-sm font-semibold">Convite pronto</p>
            </div>
            <p className="mt-2 font-tech text-xs text-bento-text break-all">{latestInvite.token}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-bento-muted">Validade: {formatDate(latestInvite.expiresAt)}</span>
              {latestInvite.token && (
                <button
                  type="button"
                  onClick={() => copyToken(latestInvite.token!)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-btn border border-lime/30 text-lime-fg text-xs min-h-[40px]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-2">Membros atuais</p>
          <div className="space-y-2">
            {members.map(member => {
              const isSelf = member.userId === currentUserId
              const canPromote = iAmOwner && !isSelf && member.role === 'member'
              const canDemote = iAmOwner && !isSelf && member.role === 'admin'
              const hasActions = canPromote || canDemote
              const busy = busyMemberId === member.id
              return (
                <div key={member.id} className="bento-fx p-3">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="grid place-items-center w-9 h-9 rounded-full bg-bento-bg border border-bento-border text-[11px] font-tech text-bento-dim shrink-0">
                      {initialsOf(member.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-bento-text truncate">
                        {member.name}
                        {isSelf && <span className="text-[11px] font-normal text-bento-dim"> (você)</span>}
                      </p>
                      {member.email && <p className="text-[11px] text-bento-muted truncate">{member.email}</p>}
                      <p className="text-[10px] text-bento-dim mt-0.5">
                        Entrada: {formatDate(member.joinedAt)} · <span className="font-tech">#{member.userId.slice(0, 8)}</span>
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-bento-border text-bento-dim flex-none">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {roleLabel[member.role]}
                    </span>
                  </div>
                  {hasActions && (
                    <div className="mt-2.5 pt-2.5 border-t border-bento-border flex flex-wrap gap-2">
                      {canPromote && (
                        <button type="button" onClick={() => changeRole(member, 'admin')} disabled={isPendingAction}
                          className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-btn text-xs font-medium border border-bento-border text-bento-text hover:border-lime hover:text-lime-fg transition-colors disabled:opacity-50">
                          <ArrowUp className="w-3.5 h-3.5" /> {busy ? 'Aplicando...' : 'Promover a admin'}
                        </button>
                      )}
                      {canDemote && (
                        <button type="button" onClick={() => changeRole(member, 'member')} disabled={isPendingAction}
                          className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-btn text-xs font-medium border border-bento-border text-bento-dim hover:text-bento-text transition-colors disabled:opacity-50">
                          <ArrowDown className="w-3.5 h-3.5" /> {busy ? 'Aplicando...' : 'Rebaixar a member'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-2">Convites pendentes</p>
          <div className="space-y-2">
            {pendingInvites.length === 0 ? (
              <p className="text-sm text-bento-muted">Nenhum convite pendente.</p>
            ) : pendingInvites.map(invite => (
              <InviteRow key={invite.id} invite={invite} onCopy={copyToken} onRevoke={revokeInvite} busy={busyInviteId === invite.id} />
            ))}
          </div>
        </div>

        {expiredInvites.length > 0 && (
          <div>
            <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-2">Convites expirados</p>
            <div className="space-y-2">
              {expiredInvites.map(invite => (
                <InviteRow key={invite.id} invite={invite} onCopy={copyToken} onRevoke={revokeInvite} busy={busyInviteId === invite.id} />
              ))}
            </div>
          </div>
        )}
        </>)}
      </div>
    </Panel>
  )
}
