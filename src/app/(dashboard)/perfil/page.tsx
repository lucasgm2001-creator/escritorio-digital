import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRequestContext } from '@/server/context/request-context'
import { getMyCompensationView, type MyCompensationView } from '@/server/services/MyCompensationService'
import { roleByKey } from '@/lib/people/catalog'
import { PerfilShell } from './PerfilShell'

export default async function PerfilPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, phone')
    .eq('id', user.id)
    .single()

  // "Minha Remuneração" (Parte 2): visão do PRÓPRIO colaborador. Resolvida no servidor por sellers.user_id =
  // usuário logado (ninguém abre a de outro). Reusa o motor real (MyCompensationService → monthlySummary).
  const context = await getRequestContext()
  const EMPTY: MyCompensationView = {
    hasComp: false, sellerName: profile?.name ?? '', cargo: null, department: null, rule: null,
    currentMonth: null, nextPayout: null, yearReceivedUsd: 0, totalReceivedUsd: 0, dealsCount: 0,
    thisWeekUsd: 0, status: 'ativo', lastUpdate: null, months: [],
    pending: { totalPendenteUsd: 0, totalPagoNasElegiveisUsd: 0, clientesPendentes: 0, clientesCompletos: 0, semanasPendentesTotais: 0, lines: [] },
  }
  const comp = context ? await getMyCompensationView(context) : EMPTY
  // Cargos do colaborador (MÚLTIPLOS) — FONTE ÚNICA team_members.role_keys (via context). O Perfil só EXIBE
  // (read-only); quem altera é Owner/Desenvolvedor em /admin/colaboradores. Sem texto livre (ACCESS-ROLES-001).
  const cargos = (context?.roleKeys ?? []).map(k => ({ key: k, name: roleByKey(k)?.name ?? k }))

  return (
    <PerfilShell
      profile={{
        userId: user.id,
        email: user.email ?? '',
        initialName: profile?.name ?? '',
        initialPhone: profile?.phone ?? '',
        cargos,
        initialAvatarUrl: profile?.avatar_url ?? null,
      }}
      comp={comp}
      workspace={context?.activeTeamName ?? 'DR Growth'}
    />
  )
}
