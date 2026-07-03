'use client'

import { useMemo, useState, useTransition } from 'react'
import { UserPlus, Copy, Hash, XCircle, Check, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createTeamInviteAction, revokeTeamInviteAction } from '@/app/(dashboard)/configuracoes/team-actions'
import { formatDate } from '../shared'

export type WorkspaceInvite = {
  id: string
  token: string | null
  expiresAt: string | null
  usedAt: string | null
  createdAt: string | null
  createdByName: string | null
}

function isExpired(inv: WorkspaceInvite): boolean {
  return !!inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()
}
function isActive(inv: WorkspaceInvite): boolean {
  return !inv.usedAt && !isExpired(inv)
}

// Aba CONVITES do Workspace Center (Part 3). Gerar + listar ativos/expirados/utilizados, cancelar, copiar o
// código ou um convite pronto, com validade, quem convidou e quando. Reusa as actions de convite existentes.
export function InvitesPanel({ invites: initial, teamName }: { invites: WorkspaceInvite[]; teamName: string | null }) {
  const [invites, setInvites] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const active = useMemo(() => invites.filter(isActive), [invites])
  const expired = useMemo(() => invites.filter(i => !i.usedAt && isExpired(i)), [invites])
  const used = useMemo(() => invites.filter(i => !!i.usedAt), [invites])

  const generate = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await createTeamInviteAction()
      if (!res.ok) { setMessage({ type: 'error', text: res.error }); return }
      setInvites(cur => [{
        id: res.data.id, token: res.data.token, expiresAt: res.data.expires_at,
        usedAt: res.data.used_at, createdAt: res.data.created_at, createdByName: 'Você',
      }, ...cur])
      setMessage({ type: 'success', text: 'Convite gerado.' })
    })
  }

  const revoke = (id: string) => {
    setMessage(null); setBusyId(id)
    startTransition(async () => {
      const res = await revokeTeamInviteAction(id)
      setBusyId(null)
      if (!res.ok) { setMessage({ type: 'error', text: res.error }); return }
      setInvites(cur => cur.filter(i => i.id !== id))
      setMessage({ type: 'success', text: 'Convite cancelado.' })
    })
  }

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setMessage({ type: 'success', text: `${label} copiado.` }) }
    catch { setMessage({ type: 'error', text: 'Não foi possível copiar.' }) }
  }
  const copyInvite = (inv: WorkspaceInvite) => {
    if (!inv.token) return
    const msg = `Você foi convidado para a equipe ${teamName ?? 'no Escritório Digital'}. No app, vá em Configurações › Equipe › "Entrar em outra equipe" e use este código: ${inv.token}`
    copy(msg, 'Convite')
  }

  const Row = ({ inv, tone }: { inv: WorkspaceInvite; tone: 'active' | 'expired' | 'used' }) => (
    <div className="rounded-bento border border-bento-border bg-bento-surface/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <span className={cn('inline-block text-[10px] px-2 py-0.5 rounded-full border font-tech uppercase tracking-wide',
            tone === 'active' && 'bg-lime/15 text-lime-fg border-lime/30',
            tone === 'expired' && 'bg-amber-900/20 text-amber-400 border-amber-800/40',
            tone === 'used' && 'bg-bento-bg text-bento-muted border-bento-border')}>
            {tone === 'active' ? 'Ativo' : tone === 'expired' ? 'Expirado' : 'Utilizado'}
          </span>
          <p className="font-tech text-xs text-bento-text break-all">{inv.token ?? '—'}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-bento-muted">
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Validade: {formatDate(inv.expiresAt)}</span>
            <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> Convidado por: {inv.createdByName ?? '—'}</span>
            <span className="text-bento-dim">Criado em {formatDate(inv.createdAt)}</span>
          </div>
        </div>
        {tone === 'active' && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button type="button" onClick={() => copyInvite(inv)} disabled={!inv.token}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-btn border border-bento-border text-bento-text text-xs hover:border-lime disabled:opacity-50">
              <Copy className="w-3.5 h-3.5" /> Copiar convite
            </button>
            <button type="button" onClick={() => inv.token && copy(inv.token, 'Código')} disabled={!inv.token}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-btn border border-bento-border text-bento-dim text-xs hover:text-bento-text disabled:opacity-50">
              <Hash className="w-3.5 h-3.5" /> Copiar código
            </button>
            <button type="button" onClick={() => revoke(inv.id)} disabled={busyId === inv.id || pending}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-btn border border-bento-border text-bento-dim text-xs hover:border-red-400/60 hover:text-red-400 disabled:opacity-50">
              <XCircle className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-bento-muted">{active.length} {active.length === 1 ? 'convite ativo' : 'convites ativos'}</p>
        <button type="button" onClick={generate} disabled={pending}
          className="bento-btn inline-flex items-center gap-2 px-4 min-h-[44px] rounded-btn text-sm font-semibold disabled:opacity-50">
          <UserPlus className="w-4 h-4" /> {pending && !busyId ? 'Gerando...' : 'Gerar convite'}
        </button>
      </div>

      {message && (
        <p className={cn('text-xs rounded-btn border px-3 py-2 inline-flex items-center gap-1.5',
          message.type === 'success' ? 'bg-lime/10 border-lime/30 text-lime-fg' : 'bg-red-400/10 border-red-400/30 text-red-400')}>
          {message.type === 'success' && <Check className="w-3.5 h-3.5" />}{message.text}
        </p>
      )}

      <section className="space-y-2">
        <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Convites ativos</p>
        {active.length === 0 ? (
          <p className="text-sm text-bento-muted">Nenhum convite ativo. Gere um para adicionar alguém à equipe.</p>
        ) : <div className="space-y-2">{active.map(inv => <Row key={inv.id} inv={inv} tone="active" />)}</div>}
      </section>

      {expired.length > 0 && (
        <section className="space-y-2">
          <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Convites expirados</p>
          <div className="space-y-2">{expired.map(inv => <Row key={inv.id} inv={inv} tone="expired" />)}</div>
        </section>
      )}

      {used.length > 0 && (
        <section className="space-y-2">
          <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Utilizados</p>
          <div className="space-y-2">{used.map(inv => <Row key={inv.id} inv={inv} tone="used" />)}</div>
        </section>
      )}
    </div>
  )
}
