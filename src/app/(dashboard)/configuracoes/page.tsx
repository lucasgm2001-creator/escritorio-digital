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
  const [teamMembers, teamInvites] = canManageTeam
    ? await Promise.all([
      getActiveTeamMembers(context),
      getActiveTeamInvites(context),
    ])
    : [[], []]

  // Status da conexão Google do usuário (service role — a tabela tem RLS sem policies). SÓ {connected, email}
  // cruza pro client: o refresh/access token NUNCA sai do servidor.
  const admin = createServiceClient()
  const { data: tok } = await admin
    .from('google_oauth_tokens')
    .select('google_email, refresh_token, access_token')
    .eq('user_id', context.user.id)
    .maybeSingle()
  const google = {
    connected: !!(tok && (tok.refresh_token || tok.access_token)),
    email: (tok?.google_email as string | null) ?? null,
  }

  return (
    <ConfiguracoesClient
      userId={context.user.id}
      google={google}
      teamSettings={canManageTeam ? {
        teamName: context.activeTeamName,
        members: teamMembers.map(member => ({
          id: member.id,
          userId: member.user_id,
          role: member.role,
          joinedAt: member.created_at,
          name: member.profile?.name ?? member.user_id,
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
