import { getRequestContext } from '@/server/context/request-context'
import { getActiveTeamMembers, getActiveTeamInvites, getTeamsOverview } from '@/server/services/TeamService'
import { WorkspaceCenter } from './WorkspaceCenter'

// Administração › Equipe = WORKSPACE CENTER (TEAM-ADMIN-002). Centro de administração da equipe, com abas.
// O layout de /admin já garante owner/admin. Reusa as MESMAS server actions (nenhuma nova regra de negócio);
// aqui só reunimos os dados de leitura e resolvemos os nomes (nunca user_id). Configurações › Equipe segue
// como self-service do usuário (trocar/sair/entrar) — não é tocada.
export default async function AdminEquipePage() {
  const context = await getRequestContext()
  const [rawMembers, rawInvites, teams] = context
    ? await Promise.all([getActiveTeamMembers(context), getActiveTeamInvites(context), getTeamsOverview(context)])
    : [[], [], []]

  // Nome resolvido por usuário (perfil.name → email → fallback) — reusado para membros e "quem convidou".
  const nameByUser = new Map<string, string>()
  for (const m of rawMembers) {
    nameByUser.set(m.user_id, m.profile?.name || m.profile?.email || 'Usuário sem nome')
  }

  const members = rawMembers.map(m => ({
    id: m.id,
    userId: m.user_id,
    name: nameByUser.get(m.user_id) ?? 'Usuário sem nome',
    email: m.profile?.email ?? null,
    role: m.role,
    joinedAt: m.created_at,
  }))

  const currentUserId = context?.user.id ?? ''
  const invites = rawInvites.map(inv => ({
    id: inv.id,
    token: inv.token,
    expiresAt: inv.expires_at,
    usedAt: inv.used_at,
    createdAt: inv.created_at,
    createdByName: inv.created_by
      ? (inv.created_by === currentUserId ? 'Você' : (nameByUser.get(inv.created_by) ?? null))
      : null,
  }))

  const ownerName = members.find(m => m.role === 'owner')?.name ?? null

  return (
    <WorkspaceCenter
      teamName={context?.activeTeamName ?? null}
      activeTeamName={context?.activeTeamName ?? null}
      currentUserId={currentUserId}
      currentRole={context?.membership?.role ?? 'member'}
      members={members}
      invites={invites}
      teams={teams}
      teamCount={context?.memberships.length ?? 0}
      ownerName={ownerName}
    />
  )
}
