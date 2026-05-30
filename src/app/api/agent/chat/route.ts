import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { getSuperAgent } from '@/lib/agents/SuperAgent'
import { checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  // Verificar autenticação
  const authResult = await requireAuth()
  if ('error' in authResult) {
    return authResult.error
  }

  // Rate limiting (20 req/min)
  if (!checkRateLimit(authResult.user.id)) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429 }
    )
  }

  try {
    const { question } = await req.json()

    if (!question || typeof question !== 'string' || question.length > 1000) {
      return NextResponse.json(
        { error: 'Pergunta inválida. Máximo 1000 caracteres.' },
        { status: 400 }
      )
    }

    // Buscar role do usuário
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authResult.user.id)
      .single()

    const userRole = profile?.role || 'comercial'

    // Chamar SuperAgent para responder
    const resposta = await getSuperAgent().chat(question, authResult.user.id, userRole)

    return NextResponse.json({ resposta })
  } catch (error) {
    console.error('[agent-chat] Failed:', error)
    return NextResponse.json(
      { error: 'Erro ao processar pergunta.' },
      { status: 500 }
    )
  }
}
