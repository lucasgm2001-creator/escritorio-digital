'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MoreVertical, ArrowUp, ArrowDown, ArrowRightLeft, Trash2, ShieldAlert, Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  changeMemberRoleAction, transferOwnershipAction, removeMemberAction,
} from '@/app/(dashboard)/configuracoes/team-actions'
import { ROLE_LABEL, ROLE_BADGE, initialsOf, formatDate, type WorkspaceRole } from '../shared'

export type WorkspaceMember = {
  id: string
  userId: string
  name: string
  email: string | null
  role: WorkspaceRole
  joinedAt: string | null
}

type Props = {
  members: WorkspaceMember[]
  currentUserId: string
  currentRole: WorkspaceRole
  teamName: string | null
  activeTeamName: string | null
}

// Aba MEMBROS do Workspace Center (Part 2). Cartão completo por membro + menu de ações (kebab). Toda a regra
// crítica é do servidor (as actions revalidam); aqui só habilitamos/ocultamos e confirmamos ações fortes.
export function MembersPanel({ members, currentUserId, currentRole, teamName, activeTeamName }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ memberId: string; kind: 'transfer' | 'remove' } | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const iAmOwner = currentRole === 'owner'
  const closeConfirm = () => { setConfirm(null); setConfirmText('') }

  const run = (member: WorkspaceMember, fn: () => Promise<{ ok: true; data: { message: string } } | { ok: false; error: string }>) => {
    setMessage(null); setMenuFor(null); setBusyId(member.id)
    startTransition(async () => {
      const res = await fn()
      setBusyId(null)
      if (!res.ok) { setMessage({ type: 'error', text: res.error }); return }
      closeConfirm()
      setMessage({ type: 'success', text: res.data.message })
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-bento-muted">{members.length} {members.length === 1 ? 'membro' : 'membros'} nesta equipe</p>
      </div>

      {message && (
        <p className={cn('text-xs rounded-btn border px-3 py-2',
          message.type === 'success' ? 'bg-lime/10 border-lime/30 text-lime-fg' : 'bg-red-400/10 border-red-400/30 text-red-400')}>
          {message.text}
        </p>
      )}

      <div className="space-y-3">
        {members.map(member => {
          const isSelf = member.userId === currentUserId
          const canPromote = iAmOwner && !isSelf && member.role === 'member'
          const canDemote = iAmOwner && !isSelf && member.role === 'admin'
          const canTransfer = iAmOwner && !isSelf && member.role !== 'owner'
          const canRemove = !isSelf && member.role !== 'owner' && (
            (iAmOwner && (member.role === 'member' || member.role === 'admin')) ||
            (currentRole === 'admin' && member.role === 'member')
          )
          const hasMenu = canPromote || canDemote || canTransfer || canRemove
          const confirming = confirm?.memberId === member.id
          const transferWord = teamName ?? member.name
          const busy = busyId === member.id

          return (
            <div key={member.id} className="rounded-bento border border-bento-border bg-bento-surface/40 p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <span aria-hidden className="grid place-items-center w-12 h-12 rounded-full bg-bento-bg border border-bento-border text-sm font-tech text-bento-dim shrink-0">
                  {initialsOf(member.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[15px] font-semibold text-bento-text truncate">{member.name}</p>
                    {isSelf && <span className="text-[11px] text-bento-dim">(você)</span>}
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-tech uppercase tracking-wide', ROLE_BADGE[member.role])}>
                      {ROLE_LABEL[member.role]}
                    </span>
                  </div>
                  <p className="text-[13px] text-bento-muted truncate mt-0.5">{member.email ?? '—'}</p>

                  {/* Meta em grade — muito espaço, boa hierarquia (Part 9). */}
                  <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-[12px]">
                    <div>
                      <dt className="text-bento-dim">Cargo</dt>
                      <dd className="text-bento-muted">—</dd>
                    </div>
                    <div>
                      <dt className="text-bento-dim">Equipe ativa</dt>
                      <dd className="text-bento-muted truncate">{activeTeamName ?? teamName ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-bento-dim">Entrou em</dt>
                      <dd className="text-bento-muted">{formatDate(member.joinedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-bento-dim" title="Ainda não rastreamos o último acesso">Último acesso</dt>
                      <dd className="text-bento-dim">—</dd>
                    </div>
                  </dl>

                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-lime-fg">
                    <Circle className="w-2 h-2 fill-current" /> Ativo
                    <span className="text-bento-dim ml-1 font-tech">#{member.userId.slice(0, 8)}</span>
                  </p>
                </div>

                {/* Menu de ações (kebab). */}
                {hasMenu && (
                  <div className="relative shrink-0">
                    <button type="button" aria-label="Ações do membro" onClick={() => setMenuFor(menuFor === member.id ? null : member.id)} disabled={pending}
                      className="grid place-items-center w-9 h-9 rounded-btn border border-bento-border text-bento-dim hover:text-bento-text hover:border-bento-dim transition-colors disabled:opacity-50">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuFor === member.id && (
                      <>
                        <button type="button" aria-hidden tabIndex={-1} onClick={() => setMenuFor(null)} className="fixed inset-0 z-10 cursor-default" />
                        <div className="absolute right-0 mt-1 z-20 w-52 rounded-bento border border-bento-border bg-bento-surface shadow-lg p-1">
                          {canPromote && (
                            <button type="button" onClick={() => run(member, () => changeMemberRoleAction(member.userId, 'admin'))}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-btn text-xs text-bento-text hover:bg-bento-bg transition-colors">
                              <ArrowUp className="w-3.5 h-3.5 text-lime-fg" /> Promover a admin
                            </button>
                          )}
                          {canDemote && (
                            <button type="button" onClick={() => run(member, () => changeMemberRoleAction(member.userId, 'member'))}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-btn text-xs text-bento-text hover:bg-bento-bg transition-colors">
                              <ArrowDown className="w-3.5 h-3.5 text-bento-dim" /> Rebaixar a member
                            </button>
                          )}
                          {canTransfer && (
                            <button type="button" onClick={() => { setMenuFor(null); setMessage(null); setConfirmText(''); setConfirm({ memberId: member.id, kind: 'transfer' }) }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-btn text-xs text-bento-text hover:bg-bento-bg transition-colors">
                              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-300" /> Transferir ownership
                            </button>
                          )}
                          {canRemove && (
                            <button type="button" onClick={() => { setMenuFor(null); setMessage(null); setConfirmText(''); setConfirm({ memberId: member.id, kind: 'remove' }) }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-btn text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" /> Remover da equipe
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Transferência — confirmação forte: digitar o nome da equipe. */}
              {confirming && confirm?.kind === 'transfer' && (
                <div className="mt-4 rounded-bento border border-amber-800/40 bg-amber-900/15 p-4 space-y-3">
                  <p className="text-sm font-semibold text-bento-text">Transferir ownership para {member.name}?</p>
                  <p className="text-xs text-bento-muted">
                    <strong className="text-bento-text">{member.name}</strong> passa a ser o owner desta equipe e você vira admin. A equipe continua com owner.
                  </p>
                  <div>
                    <label className="block text-[11px] text-bento-muted mb-1">Para confirmar, digite <strong className="text-bento-text">{transferWord}</strong></label>
                    <input value={confirmText} onChange={e => setConfirmText(e.target.value)} disabled={pending} placeholder={transferWord}
                      className="w-full bg-bento-bg border border-bento-border rounded-btn px-3 min-h-[40px] text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-amber-500/50 disabled:opacity-50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => run(member, () => transferOwnershipAction(member.userId))} disabled={pending || confirmText.trim() !== transferWord}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-btn text-xs font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 min-h-[40px]">
                      <ArrowRightLeft className="w-3.5 h-3.5" /> {busy ? 'Transferindo...' : 'Confirmar transferência'}
                    </button>
                    <button type="button" onClick={closeConfirm} disabled={pending}
                      className="px-3 py-2 rounded-btn text-xs border border-bento-border text-bento-dim hover:text-bento-text transition-colors disabled:opacity-50 min-h-[40px]">Cancelar</button>
                  </div>
                </div>
              )}

              {/* Remoção — confirmação: mostra o nome e deixa claro que só a participação sai. */}
              {confirming && confirm?.kind === 'remove' && (
                <div className="mt-4 rounded-bento border border-red-800/40 bg-red-900/15 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-bento-text">Remover {member.name} da equipe?</p>
                      <p className="text-xs text-bento-muted mt-1">
                        <strong className="text-bento-text">{member.name}</strong> perde o acesso a esta equipe. Nenhum lead, cliente ou dado é apagado — só a participação na equipe é removida.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => run(member, () => removeMemberAction(member.userId))} disabled={pending}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-btn text-xs font-semibold bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 disabled:opacity-50 min-h-[40px]">
                      <Trash2 className="w-3.5 h-3.5" /> {busy ? 'Removendo...' : 'Remover membro'}
                    </button>
                    <button type="button" onClick={closeConfirm} disabled={pending}
                      className="px-3 py-2 rounded-btn text-xs border border-bento-border text-bento-dim hover:text-bento-text transition-colors disabled:opacity-50 min-h-[40px]">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
