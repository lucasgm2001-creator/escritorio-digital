import { UserPlus } from 'lucide-react'
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
        members={members.map(member => ({
          id: member.id,
          userId: member.user_id,
          role: member.role,
          joinedAt: member.created_at,
          name: member.profile?.name ?? member.user_id,
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
