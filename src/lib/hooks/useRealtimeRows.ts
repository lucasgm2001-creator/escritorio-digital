'use client'

import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { createClient } from '@/lib/supabase/client'

// Assina o Supabase Realtime (postgres_changes) de UMA tabela e aplica no estado local
// por MERGE POR id — mesmo padrão do HallClient, generalizado:
//   INSERT → adiciona na frente se ainda não existir (por id)
//   UPDATE → substitui no lugar (por id)  → reconcilia o eco das ações otimistas
//   DELETE → remove (por id)
// O guard "por id" evita duplicar/piscar quando o eco da própria ação do usuário chega.
// Canal com sufixo único por mount → não colide se a mesma tabela for assinada em 2 telas.
export function useRealtimeRows<T extends { id: string }>(
  table: string,
  setRows: Dispatch<SetStateAction<T[]>>,
) {
  useEffect(() => {
    const supabase = createClient()
    const suffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())
    const channel = supabase
      .channel(`rt:${table}:${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as T
          setRows(prev => (prev.some(r => r.id === row.id) ? prev : [row, ...prev]))
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as T
          setRows(prev => prev.map(r => (r.id === row.id ? { ...r, ...row } : r)))
        } else if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) setRows(prev => prev.filter(r => r.id !== id))
        }
      })
      .subscribe()

    return () => { channel.unsubscribe().then(() => supabase.removeChannel(channel)) }
  }, [table, setRows])
}
