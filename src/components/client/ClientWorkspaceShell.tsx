'use client'

import { buildClientConfig } from '@/lib/client/sections'
import { ClientWorkspaceHeader } from './ClientWorkspaceHeader'
import { ClientSectionTabs } from './ClientSectionTabs'

// Casca do Workspace do Cliente (CLIENT-SHELL-001). Vive DENTRO do DashboardShell (grupo (dashboard)), que já
// fornece o rail global + a topbar global (relógios/switcher/usuário) + a BottomNav. Por isso aqui NÃO existe
// uma 2ª casca: o DomainShell foi REMOVIDO deste caminho (era a causa raiz da duplicação — rail + topbar +
// aside + header mobile dobrados). Aqui só ficam o nível "Cliente" (header/breadcrumb) + o nível "Seção" (abas
// horizontais) + o conteúdo, mais largo (max-w-6xl). Resultado: Global → Cliente → Seção → Conteúdo, com no
// máximo 2 níveis de navegação. O DomainShell segue sendo a RAIZ de /admin e /trafego (fora de (dashboard)),
// inalterado.
export function ClientWorkspaceShell({ clientId, clientName, subtitle, children }: {
  clientId: string
  clientName: string
  subtitle: string | null
  children: React.ReactNode
}) {
  const config = buildClientConfig(clientId, clientName)
  return (
    <div className="flex flex-col min-h-full">
      <ClientWorkspaceHeader clientName={clientName} subtitle={subtitle} />
      <ClientSectionTabs config={config} />
      <div className="flex-1 mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8 py-5 md:py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}
