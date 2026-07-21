import { ScrollText } from 'lucide-react'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'
import { getRecentActivities } from '@/server/services/AdminOverviewService'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { Panel } from '@/components/bento/Panel'
import { EmptyState } from '@/components/ui/EmptyState'
import { TimeAgo } from '@/components/system/TimeAgo'

// Administração › Auditoria (ADMIN-REAL-001): timeline REAL das ações da equipe (tabela `activities`, que o
// app já grava). Só leitura, escopado à equipe ativa. Sem dados → estado vazio honesto.
export default async function AuditoriaPage() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  const activities = context ? await getRecentActivities(context, 60) : []

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        breadcrumb={['Administração', 'Auditoria']}
        title="Auditoria"
        subtitle="Registro cronológico das ações da equipe."
      />

      {activities.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nenhuma atividade registrada"
          description="As ações da equipe (leads, vendas, tarefas, reuniões) aparecem aqui conforme acontecem."
        />
      ) : (
        <Panel label={`Atividade recente · ${activities.length}`}>
          <ul className="-my-1 divide-y divide-bento-border">
            {activities.map(a => (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 text-[10px] font-tech uppercase tracking-wide text-bento-dim border border-bento-border rounded-full px-1.5 py-0.5 shrink-0">
                  {a.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-bento-text leading-snug">{a.description}</p>
                  <p className="text-[11px] text-bento-muted mt-0.5">
                    {a.user_name ?? 'Sistema'}{a.created_at && <> · <TimeAgo date={a.created_at} /></>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
