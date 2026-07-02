'use client'

import { createContext, useContext } from 'react'

// Papel do usuário na EQUIPE ativa (TEAM-001), vindo do getRequestContext no servidor.
export type Role = 'guest' | 'member' | 'admin' | 'owner'

const RoleContext = createContext<Role>('guest')

export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useRole(): Role {
  return useContext(RoleContext)
}

// Só owner/admin veem configuração de comissão/remuneração. member/guest não.
// (Guarda de UI — a proteção definitiva do DADO é RLS, etapa futura.)
export function useCanManageTeam(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin'
}
