import { ShieldCheck, Crown, UserMinus, KeyRound, Database } from 'lucide-react'
import { MAX_TEAMS_PER_USER } from '@/lib/teams/limits'
import { ROLE_LABEL, type WorkspaceRole } from '../shared'

type Props = {
  currentRole: WorkspaceRole
  teamName: string | null
  teamCount: number
  memberCount: number
}

// Aba SEGURANÇA (Part 1) — resumo honesto das proteções REAIS da equipe (Team Security). Sem promessas: cada
// item abaixo já está implementado no servidor. Informativo.
export function SecurityPanel({ currentRole, teamName, teamCount, memberCount }: Props) {
  const protections: { icon: typeof Crown; title: string; body: string }[] = [
    { icon: Crown, title: 'Sucessão de owner', body: 'Se o owner sai, o sistema promove um sucessor (admin mais antigo → member mais antigo) ANTES de remover o antigo. A equipe nunca fica sem owner.' },
    { icon: ShieldCheck, title: 'Owner único protegido', body: 'O owner único (sem outro membro) não consegue sair nem ser removido — a equipe nunca fica órfã ou vazia.' },
    { icon: KeyRound, title: 'Confirmação forte', body: 'Ações críticas (sair, transferir ownership) exigem digitar o nome da equipe. Nada acontece por um clique acidental.' },
    { icon: UserMinus, title: 'Remoção sem perda de dados', body: 'Remover ou sair apaga apenas a participação (team_members). Nenhum lead, cliente, dado financeiro ou operacional é apagado.' },
    { icon: Database, title: 'Regras no servidor', body: `Quem-pode-o-quê, sucessão e o limite de ${MAX_TEAMS_PER_USER} equipes por usuário são validados no servidor (não só na interface).` },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-bento border border-bento-border bg-bento-surface/40 p-5">
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-4">Sessão &amp; acesso</p>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div className="space-y-0.5">
            <dt className="text-[12px] text-bento-dim">Workspace ativo</dt>
            <dd className="text-bento-text font-medium truncate">{teamName ?? '—'}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-[12px] text-bento-dim">Seu papel</dt>
            <dd className="text-bento-text font-medium">{ROLE_LABEL[currentRole]}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-[12px] text-bento-dim">Alcance</dt>
            <dd className="text-bento-text font-medium">{memberCount} {memberCount === 1 ? 'membro' : 'membros'} · {teamCount} {teamCount === 1 ? 'equipe' : 'equipes'}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2">
        <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Proteções da equipe</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {protections.map(p => {
            const Icon = p.icon
            return (
              <div key={p.title} className="rounded-bento border border-bento-border bg-bento-surface/40 p-4 flex items-start gap-3">
                <span className="grid place-items-center w-8 h-8 rounded-btn bg-bento-bg border border-bento-border shrink-0">
                  <Icon className="w-4 h-4 text-lime-fg" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-bento-text">{p.title}</p>
                  <p className="text-[12px] text-bento-muted mt-0.5 leading-relaxed">{p.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
