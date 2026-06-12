import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TarefasClient } from './TarefasClient'
import type { Task, LinkOption } from './types'

export default async function TarefasPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Tarefas do dono. Se a tabela ainda não existir (migration não rodada),
  // `data` vem null → tratamos como lista vazia (a tela renderiza normalmente).
  const [tasksRes, leadsRes, clientsRes, profileRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', user.id).order('due_date', { ascending: true }),
    supabase.from('leads').select('id, name, phone, company, nicho').order('name'),
    supabase.from('clients').select('id, name, phone, company').order('name'),
    supabase.from('profiles').select('id, name').eq('id', user.id).single(),
  ])

  const linkOptions: LinkOption[] = [
    ...(leadsRes.data ?? []).map(l => ({ type: 'lead' as const, id: l.id, name: l.name, phone: l.phone, detail: l.nicho || l.company || null })),
    ...(clientsRes.data ?? []).map(c => ({ type: 'client' as const, id: c.id, name: c.name, phone: c.phone, detail: c.company || null })),
  ]

  return (
    <TarefasClient
      initialTasks={(tasksRes.data ?? []) as Task[]}
      linkOptions={linkOptions}
      currentUser={{ id: profileRes.data?.id ?? user.id, name: profileRes.data?.name ?? '' }}
    />
  )
}
