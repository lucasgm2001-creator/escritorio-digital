import { redirect } from 'next/navigation'
import { capitalizeName } from '@/lib/utils'
import { canAccessAdmin } from '@/lib/permissions/admin-access'
import { getRequestContext, switcherTeamsFromContext } from '@/server/context/request-context'
import { AdminShell } from '@/components/admin/AdminShell'
import { ModuleAccessProvider } from '@/components/auth/ModuleAccessProvider'
import { ToastProvider } from '@/components/ui/toast'
import { RoleProvider } from '@/components/auth/RoleProvider'
import { DOMAIN_CONFIGS } from '@/lib/domain/registry'

export const metadata = { title: 'Administração · Escritório Digital' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getRequestContext()
  if (!context) redirect('/login')
  if (context.memberships.length === 0) redirect('/onboarding')
  // Administração = OWNER ou cargo com adminAccess (Desenvolvedor) — FONTE ÚNICA canAccessAdmin.
  // CLIENT-HISTORY-ADMIN-003: a Administração passou a HOSPEDAR a lista de Clientes, então quem tem o módulo
  // 'clientes' também ENTRA (para chegar em /admin/clientes) mesmo sem gestão de equipe. A nav abaixo é filtrada
  // e cada seção de GESTÃO tem seu requireAdminManage — um membro operacional só enxerga/abre Clientes.
  const canManage = canAccessAdmin(context)
  const canClients = (context.moduleAccess['clientes'] ?? 'none') !== 'none'
  if (!canManage && !canClients) redirect('/hall')

  const userName = capitalizeName(context.profile?.name ?? context.user.email?.split('@')[0] ?? 'Usuário')
  const teams = switcherTeamsFromContext(context)

  // Nav filtrada por permissão (sem tocar na casca genérica): owner/dev veem todas as seções; quem só tem
  // Clientes vê apenas essa. Reusa o registro estático e filtra as sections — o DomainShell aceita config pronto.
  const base = DOMAIN_CONFIGS.admin
  const config = canManage ? base : { ...base, sections: base.sections.filter(s => s.key === 'clientes') }

  return (
    <ModuleAccessProvider access={context.moduleAccess} canManageTeam={canManage}>
      <AdminShell
        activeTeamName={context.activeTeamName}
        userName={userName}
        role={context.role}
        userEmail={context.user.email ?? null}
        avatarUrl={context.profile?.avatar_url ?? null}
        teams={teams}
        config={config}
      >
        {/* HOTFIX/FIX-REMUNERACAO-PROVIDER: a Administração herda componentes client do Comercial
            (VendedoresTab/CommissionSection) que dependem destes contextos — mesmo padrão do
            (dashboard)/layout.tsx. Sem ToastProvider, useToast lançava e derrubava /admin/remuneracao.
            RoleProvider expõe activeTeamId (ClientPaymentsPanel carimba a equipe certa em vez de null). */}
        <ToastProvider>
          <RoleProvider role={context.role} activeTeamId={context.activeTeamId}>
            {children}
          </RoleProvider>
        </ToastProvider>
      </AdminShell>
    </ModuleAccessProvider>
  )
}
