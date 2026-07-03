import { LeadAttachments } from '@/components/lead/LeadAttachments'
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader'

// Arquivos do Cliente — REUSA o LeadAttachments (estrutura visual de anexos). Sem upload/banco.
export default function ClientArquivosPage() {
  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title="Arquivos"
        subtitle="Contratos, propostas, criativos, relatórios e materiais do cliente."
        size="compact"
      />
      <LeadAttachments />
    </div>
  )
}
