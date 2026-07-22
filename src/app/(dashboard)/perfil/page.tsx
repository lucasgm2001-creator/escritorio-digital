import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { getMyCompensationView } from '@/server/services/MyCompensationService'
import { roleByKey } from '@/lib/people/catalog'
import { PerfilShell } from './PerfilShell'

export default async function PerfilPage() {
  const context = await getRequestContext()
  if (!context) redirect('/login')
  const supabase = createClient()

  // "Minha Remuneração" (Parte 2): visão do PRÓPRIO colaborador. Resolvida no servidor por sellers.user_id =
  // usuário logado (ninguém abre a de outro). Reusa o motor real (MyCompensationService → monthlySummary).
  const [{ data: profile }, comp] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar_url, phone').eq('id', context.user.id).single(),
    getMyCompensationView(context),
  ])
  // Cargos do colaborador (MÚLTIPLOS) — FONTE ÚNICA team_members.role_keys (via context). O Perfil só EXIBE
  // (read-only); quem altera é Owner/Desenvolvedor em /admin/colaboradores. Sem texto livre (ACCESS-ROLES-001).
  const cargos = (context?.roleKeys ?? []).map(k => ({ key: k, name: roleByKey(k)?.name ?? k }))

  return (
    <PerfilShell
      profile={{
        userId: context.user.id,
        email: context.user.email ?? '',
        initialName: profile?.name ?? '',
        initialPhone: profile?.phone ?? '',
        cargos,
        initialAvatarUrl: profile?.avatar_url ?? null,
      }}
      comp={comp}
      workspace={context.activeTeamName ?? 'DR Growth'}
    />
  )
}
