'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

// Cabeçalho de CONTEXTO do cliente — o nível "Cliente" em Global → Cliente → Seção → Conteúdo. NÃO é uma 2ª
// topbar de navegação: é identidade/breadcrumb. O rail global + a topbar global (relógios/switcher/usuário) e a
// BottomNav vêm do DashboardShell. Aqui só: voltar p/ Clientes + nome + empresa.
export function ClientWorkspaceHeader({ clientName, subtitle, backHref = '/clientes', backLabel = 'Clientes' }: {
  clientName: string
  subtitle?: string | null
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="border-b border-bento-border bg-bento-bg shrink-0">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8 py-3.5 flex items-center gap-2 min-w-0">
        <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-bento-muted hover:text-bento-text transition-colors shrink-0 min-h-[36px]">
          <ChevronLeft className="w-4 h-4 shrink-0" /> {backLabel}
        </Link>
        <span className="text-bento-dim shrink-0" aria-hidden>/</span>
        <div className="min-w-0 flex items-baseline gap-2">
          <h1 className="font-display font-bold text-bento-text text-base md:text-lg truncate">{clientName}</h1>
          {subtitle && <span className="text-[13px] text-bento-muted truncate hidden sm:inline">{subtitle}</span>}
        </div>
      </div>
    </div>
  )
}
