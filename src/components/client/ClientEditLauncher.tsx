'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { ClienteModal } from '@/app/(dashboard)/clientes/ClienteModal'
import type { Client } from '@/app/(dashboard)/clientes/types'

// "Editar cliente" DENTRO do Workspace (CLIENT-PROFILE-GEO-001, Parte 1). REUSA o ClienteModal — nenhum formulário
// novo, nenhum segundo cadastro. Ao salvar, router.refresh() re-busca o Resumo (server component) para refletir os
// dados atualizados na hora; como o ClienteModal grava a MESMA fonte (clients.*), o mapa/dashboard também batem.
export function ClientEditLauncher({ client }: { client: Client }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 min-h-[36px] rounded-btn border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors shrink-0">
        <Pencil className="w-3.5 h-3.5" /> Editar cliente
      </button>
      {open && (
        <ClienteModal
          client={client}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}
