'use client'

import { createContext, useContext } from 'react'
import type { ModuleLevel } from '@/lib/permissions/types'

// Níveis EFETIVOS por módulo (resolvidos no servidor pelo getRequestContext) expostos ao client SÓ para a
// navegação decidir o que MOSTRAR ("Sem acesso → nem aparece"). NÃO é autoridade: a proteção real é a guarda
// de rota + o can() no servidor. Ausência do provider = fail-open (mostra tudo) — some só quando há resolução.
export type ModuleAccessValue = { access: Record<string, ModuleLevel>; canManageTeam: boolean }

const ModuleAccessContext = createContext<ModuleAccessValue | null>(null)

export function ModuleAccessProvider({ access, canManageTeam, children }: ModuleAccessValue & { children: React.ReactNode }) {
  return (
    <ModuleAccessContext.Provider value={{ access, canManageTeam }}>
      {children}
    </ModuleAccessContext.Provider>
  )
}

// null quando não há provider (nav mostra tudo — fail-open). Presente ⇒ nav filtra pelos níveis.
export function useModuleAccess(): ModuleAccessValue | null {
  return useContext(ModuleAccessContext)
}
