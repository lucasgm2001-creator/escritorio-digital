import { NextResponse } from 'next/server'
import { createClient } from './server'

// Autenticação de rota de API (sessão). NÃO faz gate por cargo — a autoridade de acesso é o
// getRequestContext / can() / canAccessAdmin (FONTE ÚNICA, ACCESS-ROLES-001). O parâmetro de role LEGADO
// (lia profiles.role com 'admin'/'comercial'/'trafego'/'financeiro') foi REMOVIDO: era morto — nenhum caller
// passava role. Devolve o client já ligado à sessão do request p/ quem precisar reusar a MESMA sessão.
export async function requireAuth() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  }
  return { user, supabase }
}
