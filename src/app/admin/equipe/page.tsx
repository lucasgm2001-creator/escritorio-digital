import { UserPlus } from 'lucide-react'
import { can } from '@/lib/permissions/can'
import { getRequestContext } from '@/server/context/request-context'
import { getActiveTeamMembers, getActiveTeamInvites } from '@/server/services/TeamService'
import { PeopleHeader } from '@/components/people/PeopleHeader'
import { TeamSettingsSection } from '@/app/(dashboard)/configuracoes/TeamSettingsSection'

// Administração › Equipe — REUSA a gestão real de membros/convites de Configurações (mesmo componente +
// mesmas server actions). O layout de /admin já garante owner/admin. Sem reescrever lógica.
export default async function AdminEquipePage() {
  const context = await getRequestContext()
  const [members, invites] = context
    ? await Promise.all([getActiveTeamMembers(context), getActiveTeamInvites(context)])
    : [[], []]

  return (
    <div className="space-y-6">
      <PeopleHeader icon={UserPlus} title="Equipe" tagline="Membros e convites do workspace." badge="Funcional" />
      <TeamSettingsSection
        teamName={context?.activeTeamName ?? null}
        canManage={context ? can(context, 'teams', 'manage') : false}
        currentUserId={context?.user.id ?? ''}
        currentRole={context?.membership?.role ?? 'member'}
        activeTeamId={context?.activeTeamId ?? ''}
        teams={(context?.memberships ?? []).map(m => ({ id: m.team_id, name: m.team?.name ?? 'Equipe', role: m.role }))}
        members={members.map(member => ({
          id: member.id,
          userId: member.user_id,
          role: member.role,
          joinedAt: member.created_at,
          // Nome NUNCA é o user_id: perfil.name → perfil.email → fallback amigável (o UUID vira só detalhe técnico).
          name: member.profile?.name || member.profile?.email || 'Usuário sem nome',
          email: member.profile?.email ?? null,
        }))}
        invites={invites.map(invite => ({
          id: invite.id,
          token: invite.token,
          expiresAt: invite.expires_at,
          usedAt: invite.used_at,
          createdAt: invite.created_at,
        }))}
      />
    </div>
  )
}
