import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'
import { IntegrationsCenter } from '@/components/integrations/IntegrationsCenter'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'

// Administração › Integrações — a Central de Integrações (INT-001). Fundação provider-agnostic: catálogo por
// domínio + Webhooks/Logs/Saúde modelados. NADA conecta, nenhuma API externa é chamada; Magnetic e Google já
// operam pelas superfícies atuais e são sinalizados como "atual". Coexiste com /admin/inbound e /admin/logs.
export default async function Page() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumb={['Administração', 'Integrações']}
        title="Central de Integrações"
        subtitle="Todas as fontes externas do workspace num só lugar. Fundação pronta — nenhuma conta conectada nesta central; Magnetic e Google já operam pelas superfícies atuais. Nada chama API externa."
        size="compact"
      />
      <IntegrationsCenter />
    </div>
  )
}
