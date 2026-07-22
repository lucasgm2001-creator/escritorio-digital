'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ChevronDown, Check, Plus, User, UserCircle, Settings, LogOut, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { switchTeamAction, createTeamAction } from '@/app/(dashboard)/configuracoes/team-actions'
import { signOut } from '@/lib/supabase/auth-actions'
import { MAX_TEAMS_PER_USER } from '@/lib/teams/limits'

export type SwitcherTeam = { id: string; name: string; role: 'owner' | 'admin' | 'member'; isActive: boolean }

const ROLE_LABEL: Record<SwitcherTeam['role'], string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Workspace Switcher GLOBAL (TEAM-ADMIN-002, Part 5). No canto superior direito dos shells. Avatar → menu:
// trocar equipe (todas, inline, sem abrir Configurações) · criar equipe · perfil · conta · configurações ·
// sair. Reusa switchTeamAction/createTeamAction/signOut — nenhuma regra nova; a autoridade é o servidor.
export function WorkspaceSwitcher({ userName, userEmail, avatarUrl, teams, variant = 'topbar', expanded = true }: {
  userName: string
  userEmail: string | null
  avatarUrl: string | null
  teams: SwitcherTeam[]
  variant?: 'topbar' | 'sidebar'
  expanded?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const close = () => { setOpen(false); setCreating(false); setTeamName(''); setError(null) }

  const onSwitch = (team: SwitcherTeam) => {
    if (team.isActive || pending) return
    setError(null)
    startTransition(async () => {
      const res = await switchTeamAction(team.id)
      if (!res.ok) { setError(res.error); return }
      close(); router.push('/mesa'); router.refresh()
    })
  }

  const onCreate = () => {
    const name = teamName.trim()
    if (name.length < 2 || pending) return
    setError(null)
    startTransition(async () => {
      const res = await createTeamAction(name)
      if (!res.ok) { setError(res.error); return }
      close(); router.push('/mesa'); router.refresh()
    })
  }

  const go = (href: string) => { close(); router.push(href) }
  const onLogout = () => { startTransition(async () => { await signOut(); window.location.href = '/login' }) }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={cn('flex items-center gap-2.5 rounded-btn hover:bg-bento-surface transition-colors min-h-[44px]',
          variant === 'sidebar' ? 'w-full px-2.5 py-1.5' : 'p-1.5')}
        aria-label="Menu do workspace" aria-expanded={open}>
        {avatarUrl ? (
          <span className="w-7 h-7 rounded-lg overflow-hidden shrink-0"><Image src={avatarUrl} alt="" width={28} height={28} className="w-full h-full object-cover" /></span>
        ) : (
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-lime text-lime-ink text-xs font-bold shrink-0">{initials(userName)}</span>
        )}
        <span className={cn('text-left leading-none min-w-0 flex-1', variant === 'sidebar' ? (expanded ? 'block' : 'hidden') : 'hidden md:block')}>
          <span className="block text-sm font-medium text-bento-text">{userName}</span>
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-bento-dim', variant === 'sidebar' ? (expanded ? 'block' : 'hidden') : 'hidden md:block')} />
      </button>

      {open && (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={close} className="fixed inset-0 z-40 cursor-default" />
          <div className={cn('absolute z-50 w-72 max-w-[calc(100vw-1rem)] max-h-[min(36rem,calc(100dvh-4rem))] rounded-bento border border-bento-border bg-bento-surface shadow-xl overflow-y-auto overscroll-contain',
            variant === 'sidebar' ? 'left-full bottom-0 ml-2' : 'right-0 top-12')}>
            {/* Identidade */}
            <div className="px-4 py-3 border-b border-bento-border">
              <p className="text-sm font-semibold text-bento-text truncate">{userName}</p>
              {userEmail && <p className="text-[12px] text-bento-muted truncate">{userEmail}</p>}
            </div>

            {/* Trocar equipe — todas as equipes, inline (Part 5). */}
            <div className="px-2 py-2 border-b border-bento-border">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="font-tech text-[10px] uppercase tracking-wide text-bento-dim">Suas equipes</p>
                <span className="font-tech text-[10px] text-bento-dim tabular-nums">{teams.length}/{MAX_TEAMS_PER_USER}</span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {teams.map(team => (
                  <button key={team.id} type="button" onClick={() => onSwitch(team)} disabled={pending}
                    className={cn('w-full flex items-center gap-2.5 px-2 py-2 rounded-btn text-left transition-colors disabled:opacity-50',
                      team.isActive ? 'bg-lime/10' : 'hover:bg-bento-bg')}>
                    <span aria-hidden className="grid place-items-center w-7 h-7 rounded-md bg-bento-bg border border-bento-border text-[10px] font-display font-bold text-bento-dim shrink-0">
                      {initials(team.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-bento-text truncate">{team.name}</span>
                      <span className="block text-[11px] text-bento-dim">{ROLE_LABEL[team.role]}</span>
                    </span>
                    {team.isActive && <Check className="w-4 h-4 text-lime-fg shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Criar equipe — inline (Part 5). */}
              {creating ? (
                <div className="px-2 pt-2 space-y-2">
                  <input autoFocus value={teamName} onChange={e => setTeamName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onCreate(); if (e.key === 'Escape') { setCreating(false); setTeamName('') } }}
                    disabled={pending} placeholder="Nome da nova equipe"
                    className="w-full bg-bento-bg border border-bento-border rounded-btn px-2.5 min-h-[40px] text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime disabled:opacity-50" />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={onCreate} disabled={pending || teamName.trim().length < 2}
                      className="bento-btn flex-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-[36px] rounded-btn text-xs font-semibold disabled:opacity-50">
                      {pending ? 'Criando…' : 'Criar e entrar'}
                    </button>
                    <button type="button" onClick={() => { setCreating(false); setTeamName('') }} disabled={pending}
                      className="px-3 min-h-[36px] rounded-btn text-xs border border-bento-border text-bento-dim hover:text-bento-text disabled:opacity-50">Cancelar</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setCreating(true); setError(null) }} disabled={pending}
                  className="w-full flex items-center gap-2.5 px-2 py-2 mt-0.5 rounded-btn text-left text-[13px] text-bento-text hover:bg-bento-bg transition-colors disabled:opacity-50">
                  <span className="grid place-items-center w-7 h-7 rounded-md border border-dashed border-bento-border text-bento-dim shrink-0"><Plus className="w-3.5 h-3.5" /></span>
                  Criar equipe
                </button>
              )}

              {error && <p className="px-2 pt-2 text-[11px] text-red-400">{error}</p>}
            </div>

            {/* Conta */}
            <div className="px-2 py-2 border-b border-bento-border">
              <MenuItem icon={User} label="Meu perfil" onClick={() => go('/perfil')} />
              <MenuItem icon={UserCircle} label="Minha conta" onClick={() => go('/configuracoes?section=conta')} />
              <MenuItem icon={Settings} label="Configurações" onClick={() => go('/configuracoes')} />
            </div>

            <div className="px-2 py-2">
              <button type="button" onClick={onLogout} disabled={pending}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-btn text-left text-[13px] text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                <LogOut className="w-4 h-4 shrink-0" /> Sair
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick }: { icon: typeof Building2; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-btn text-left text-[13px] text-bento-text hover:bg-bento-bg transition-colors">
      <Icon className="w-4 h-4 text-bento-dim shrink-0" /> {label}
    </button>
  )
}
