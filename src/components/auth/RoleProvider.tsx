'use client'

import { createContext, useContext } from 'react'

// Papel do usuário na EQUIPE ativa (TEAM-001), vindo do getRequestContext no servidor.
export type Role = 'guest' | 'member' | 'admin' | 'owner'

const RoleContext = createContext<Role>('guest')
const ActiveTeamContext = createContext<string | null>(null)

export function RoleProvider({ role, activeTeamId = null, children }: { role: Role; activeTeamId?: string | null; children: React.ReactNode }) {
  return (
    <RoleContext.Provider value={role}>
      <ActiveTeamContext.Provider value={activeTeamId}>{children}</ActiveTeamContext.Provider>
    </RoleContext.Provider>
  )
}

export function useRole(): Role {
  return useContext(RoleContext)
}

// Equipe ativa (TEAM-001) exposta ao client SÓ para carimbar team_id nas escritas (FIX-P0-TEAMID-WRITES): o
// trigger set_team_id_default() só carimba para usuário de 1 equipe, então com multi-equipe a escrita precisa
// enviar o team_id explícito. A RLS (team_scope) segue sendo a autoridade — isto é só para não gravar NULL.
export function useActiveTeamId(): string | null {
  return useContext(ActiveTeamContext)
}

// Só owner/admin veem configuração de comissão/remuneração. member/guest não.
// (Guarda de UI — a proteção definitiva do DADO é RLS, etapa futura.)
export function useCanManageTeam(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin'
}
