import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { getSuperAgent } from '@/lib/agents/SuperAgent'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  // Verificar autenticação
  const authResult = await requireAuth()
  if ('error' in authResult) {
    return authResult.error
  }

  // Rate limiting (20 req/min)
  const rateLimitInfo = checkRateLimit(authResult.user.id)
  if (!rateLimitInfo.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': String(rateLimitInfo.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimitInfo.resetTime / 1000)),
        },
      }
    )
  }

  try {
    const body = await req.json()

    // Aceita o histórico da conversa ({messages:[{role,content}]}) ou a forma
    // antiga ({question}). O histórico permite correções ("não, a empresa é Souza").
    let messages: { role: 'user' | 'assistant'; content: string }[]
    if (Array.isArray(body.messages)) {
      const raw = body.messages as unknown[]
      messages = raw
        .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
          !!m && typeof m === 'object'
          && ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant')
          && typeof (m as { content?: unknown }).content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
        .slice(-12)
    } else if (typeof body.question === 'string') {
      messages = [{ role: 'user', content: body.question.slice(0, 2000) }]
    } else {
      return NextResponse.json({ error: 'Mensagem inválida.' }, { status: 400 })
    }

    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'Mensagem inválida.' }, { status: 400 })
    }
    if (messages.reduce((n, m) => n + m.content.length, 0) > 12000) {
      return NextResponse.json({ error: 'Conversa muito longa. Recomece o chat.' }, { status: 400 })
    }

    const today = typeof body.today === 'string' ? body.today : new Date().toISOString().slice(0, 10)
    const todayLabel = typeof body.todayLabel === 'string' ? body.todayLabel : today

    // App pessoal de usuário único: sem papéis. O agente responde/age com acesso total.
    const out = await getSuperAgent().chatWithActions(messages, { today, todayLabel })

    if (out.type === 'action') {
      return NextResponse.json({ resposta: out.resposta, pendingAction: { tool: out.tool, params: out.params } })
    }
    return NextResponse.json({ resposta: out.resposta })
  } catch (error) {
    console.error('[agent-chat] Failed:', error)
    return NextResponse.json(
      { error: 'Erro ao processar pergunta.' },
      { status: 500 }
    )
  }
}
