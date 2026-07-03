import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABEL, type WorkspaceRole } from '../shared'

// Aba PERMISSÕES (Part 1) — matriz de papéis. Espelha EXATAMENTE as regras que o servidor aplica (can.ts +
// TeamService): owner faz tudo; admin convida/vê/remove member; member usa a equipe e sai. Somente leitura —
// a fonte da verdade continua no servidor.
const CAPABILITIES: { label: string; owner: boolean; admin: boolean; member: boolean; note?: string }[] = [
  { label: 'Acessar a Administração (este Workspace)', owner: true, admin: true, member: false },
  { label: 'Convidar membros', owner: true, admin: true, member: false },
  { label: 'Revogar convites', owner: true, admin: true, member: false },
  { label: 'Promover / rebaixar (member ↔ admin)', owner: true, admin: false, member: false },
  { label: 'Transferir ownership', owner: true, admin: false, member: false },
  { label: 'Remover member', owner: true, admin: true, member: false },
  { label: 'Remover admin', owner: true, admin: false, member: false },
  { label: 'Sair da equipe', owner: true, admin: true, member: true, note: 'Owner sai com sucessão automática; owner único é bloqueado.' },
]

const COLS: WorkspaceRole[] = ['owner', 'admin', 'member']

function Cell({ on }: { on: boolean }) {
  return on
    ? <Check className="w-4 h-4 text-lime-fg mx-auto" aria-label="Permitido" />
    : <Minus className="w-4 h-4 text-bento-dim mx-auto" aria-label="Não permitido" />
}

export function PermissionsPanel({ currentRole }: { currentRole: WorkspaceRole }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-bento-muted">
        O que cada papel pode fazer. As regras são aplicadas no servidor — a interface apenas reflete. Seu papel: <strong className="text-bento-text">{ROLE_LABEL[currentRole]}</strong>.
      </p>

      <div className="rounded-bento border border-bento-border overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="border-b border-bento-border">
              <th className="text-left font-medium text-bento-muted px-4 py-3">Capacidade</th>
              {COLS.map(role => (
                <th key={role} className={cn('font-tech text-[11px] uppercase tracking-wide px-4 py-3 text-center w-24',
                  role === currentRole ? 'text-lime-fg' : 'text-bento-muted')}>
                  {ROLE_LABEL[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map(cap => (
              <tr key={cap.label} className="border-b border-bento-border/60 last:border-0">
                <td className="px-4 py-3 text-bento-text">
                  {cap.label}
                  {cap.note && <span className="block text-[11px] text-bento-dim mt-0.5">{cap.note}</span>}
                </td>
                <td className={cn('px-4 py-3', currentRole === 'owner' && 'bg-lime/5')}><Cell on={cap.owner} /></td>
                <td className={cn('px-4 py-3', currentRole === 'admin' && 'bg-lime/5')}><Cell on={cap.admin} /></td>
                <td className={cn('px-4 py-3', currentRole === 'member' && 'bg-lime/5')}><Cell on={cap.member} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
