import { redirect } from 'next/navigation'
import { capitalizeName } from '@/lib/utils'
import { canAccessAdmin } from '@/lib/permissions/admin-access'
import { getRequestContext, switcherTeamsFromContext } from '@/server/context/request-context'
import { AdminShell } from '@/components/admin/AdminShell'
import { ModuleAccessProvider } from '@/components/auth/ModuleAccessProvider'
import { ToastProvider } from '@/components/ui/toast'
import { RoleProvider } from '@/components/auth/RoleProvider'

export const metadata = { title: 'Administração · Escritório Digital' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getRequestContext()
  if (!context) redirect('/login')
  if (context.memberships.length === 0) redirect('/onboarding')
  // Administração = OWNER ou cargo com adminAccess (Desenvolvedor). FONTE ÚNICA canAccessAdmin — nada
  // hardcoded; nem 'admin' role sozinho nem override de módulo entram (ACCESS-ROLES-001, Parte 1).
  if (!canAccessAdmin(context)) redirect('/hall')

  const userName = capitalizeName(context.profile?.name ?? context.user.email?.split('@')[0] ?? 'Usuário')
  const teams = switcherTeamsFromContext(context)

  return (
    <ModuleAccessProvider access={context.moduleAccess} canManageTeam={canAccessAdmin(context)}>
      <AdminShell
        activeTeamName={context.activeTeamName}
        userName={userName}
        role={context.role}
        userEmail={context.user.email ?? null}
        avatarUrl={context.profile?.avatar_url ?? null}
        teams={teams}
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
