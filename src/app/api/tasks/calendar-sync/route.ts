import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { syncTaskCalendar, deleteTaskEvent } from '@/lib/googleCalendar'

// Sincroniza UMA tarefa com o Google Agenda (conta de serviço). SÓ servidor — a credencial nunca sai
// daqui. BEST-EFFORT no fluxo do cliente (salvar/excluir tarefa NUNCA depende disto), mas agora a rota
// devolve o RESULTADO REAL ({ok:false, step, reason} em falha) pra o client avisar com um toast discreto.
// googleapis precisa de Node (não Edge).
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    // Auth + dono. syncTaskCalendar lê a task via service-role (ignora RLS), então a checagem de dono
    // tem que ser feita AQUI: o usuário logado só pode sincronizar/excluir evento de tarefa DELE (anti-IDOR).
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth

    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    // Excluir: a linha some no cliente; apagamos o evento pelo id que veio do estado.
    if (body?.deleteEventId) {
      const r = await deleteTaskEvent(String(body.deleteEventId))
      return NextResponse.json(r)
    }
    // Criar/Editar: lê a tarefa fresca e reconcilia (cria/atualiza/remove o evento + grava o id).
    if (body?.taskId) {
      // Confirma que a task é do usuário ANTES de sincronizar (RLS + filtro explícito por user_id).
      const { data: own } = await supabase
        .from('tasks').select('id').eq('id', String(body.taskId)).eq('user_id', user.id).maybeSingle()
      if (!own) return NextResponse.json({ ok: false, step: 'auth', reason: 'forbidden' }, { status: 403 })
      const r = await syncTaskCalendar(String(body.taskId))
      return NextResponse.json(r)
    }
    return NextResponse.json({ ok: false, step: 'input', reason: 'taskId ou deleteEventId obrigatório' }, { status: 400 })
  } catch (e) {
    // Erro inesperado na própria rota: loga e devolve ok:false (HTTP 200) — o client só avisa, NÃO reverte
    // o salvar/excluir da tarefa (que já aconteceu antes desta chamada).
    console.error('[api/tasks/calendar-sync] erro na rota:', e)
    return NextResponse.json({ ok: false, step: 'route', reason: 'erro interno na sincronização' })
  }
}
