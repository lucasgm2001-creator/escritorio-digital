import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions/can'
import { createServiceClient } from '@/lib/supabase/service'
import { getRequestContext } from '@/server/context/request-context'
import { getActiveTeamInvites, getActiveTeamMembers } from '@/server/services/TeamService'
import { ConfiguracoesClient } from './ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const context = await getRequestContext()
  if (!context) redirect('/login')

  const canManageTeam = can(context, 'teams', 'manage')
  // Membros: qualquer usuário com equipe ativa (o RLS já limita o que um member enxerga) — permite trocar/sair.
  // Convites: só quem administra (getActiveTeamInvites exige a permissão e lançaria para um member).
  // Status da conexão Google do usuário (service role — a tabela tem RLS sem policies). SÓ {connected, email}
  // cruza pro client: o refresh/access token NUNCA sai do servidor.
  const admin = createServiceClient()
  const [teamMembers, teamInvites, { data: tok }] = await Promise.all([
    context.activeTeamId ? getActiveTeamMembers(context) : Promise.resolve([]),
    canManageTeam ? getActiveTeamInvites(context) : Promise.resolve([]),
    admin.from('google_oauth_tokens')
      .select('google_email, refresh_token, access_token')
      .eq('user_id', context.user.id)
      .maybeSingle(),
  ])
  const google = {
    connected: !!(tok && (tok.refresh_token || tok.access_token)),
    email: (tok?.google_email as string | null) ?? null,
  }

  return (
    <ConfiguracoesClient
      userId={context.user.id}
      google={google}
      teamSettings={context.activeTeamId ? {
        teamName: context.activeTeamName,
        canManage: canManageTeam,
        currentUserId: context.user.id,
        currentRole: context.membership?.role ?? 'member',
        activeTeamId: context.activeTeamId,
        teams: context.memberships.map(m => ({ id: m.team_id, name: m.team?.name ?? 'Equipe', role: m.role })),
        members: teamMembers.map(member => ({
          id: member.id,
          userId: member.user_id,
          role: member.role,
          joinedAt: member.created_at,
          // Nome NUNCA é o user_id: perfil.name → perfil.email → fallback amigável (o UUID vira só detalhe técnico).
          name: member.profile?.name || member.profile?.email || 'Usuário sem nome',
          email: member.profile?.email ?? null,
        })),
        invites: teamInvites.map(invite => ({
          id: invite.id,
          token: invite.token,
          expiresAt: invite.expires_at,
          usedAt: invite.used_at,
          createdAt: invite.created_at,
        })),
      } : null}
    />
  )
}
