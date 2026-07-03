import { LeadAttachments } from '@/components/lead/LeadAttachments'

// Arquivos do Cliente — REUSA o LeadAttachments (estrutura visual de anexos). Sem upload/banco.
export default function ClientArquivosPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-display font-bold text-xl text-bento-text">Arquivos</h1>
        <p className="text-sm text-bento-muted">Contratos, propostas, criativos, relatórios e materiais do cliente.</p>
      </header>
      <LeadAttachments />
    </div>
  )
}
