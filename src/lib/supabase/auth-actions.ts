'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from './server'

export async function signIn(email: string, password: string) {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.includes('Email not confirmed')) {
      return { error: 'E-mail não confirmado. Confirme no Supabase Dashboard ou desative a confirmação nas configurações.' }
    }
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Senha incorreta. Tente novamente.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/hall')
}

// Cadastro com TRAVA (fail-safe): só cria conta se o DOMÍNIO do e-mail estiver liberado
// (NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS) OU se o CÓDIGO DE CONVITE bater (INVITE_CODE, validado AQUI no
// servidor). Sem nenhuma das duas envs setadas → cadastro BLOQUEADO por padrão. Não expõe segredo.
export async function signUp(name: string, email: string, password: string, inviteCode: string) {
  const nm = (name ?? '').trim()
  const em = (email ?? '').trim().toLowerCase()
  if (!nm || !em || !password) return { error: 'Preencha nome, e-mail e senha.' }

  const domain = em.split('@')[1] ?? ''
  const allowedDomains = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',').map(d => d.trim().toLowerCase()).filter(Boolean)
  const expectedCode = (process.env.INVITE_CODE ?? '').trim()
  const code = (inviteCode ?? '').trim()
  const domainOk = allowedDomains.length > 0 && !!domain && allowedDomains.includes(domain)
  const codeOk = expectedCode.length > 0 && code.length > 0 && code === expectedCode
  if (!domainOk && !codeOk) {
    if (allowedDomains.length === 0 && expectedCode.length === 0) return { error: 'Cadastro indisponível no momento.' }
    if (code) return { error: 'Código de convite inválido.' }
    return { error: 'E-mail não autorizado. Use um e-mail autorizado ou um código de convite.' }
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({ email: em, password, options: { data: { name: nm } } })
  if (error) {
    const m = error.message.toLowerCase()
    if (m.includes('already') || m.includes('registered')) return { error: 'Este e-mail já tem conta. Faça login.' }
    if (m.includes('password')) return { error: 'Senha fraca — use ao menos 6 caracteres.' }
    return { error: 'Não foi possível criar a conta. Tente novamente.' }
  }

  // Sessão imediata (confirmação de e-mail desligada): garante a linha em profiles (upsert por id —
  // não duplica se já houver trigger) e entra logado.
  if (data.user && data.session) {
    await supabase.from('profiles').upsert({ id: data.user.id, name: nm }, { onConflict: 'id' })
    revalidatePath('/', 'layout')
    redirect('/hall')
  }
  // Confirmação de e-mail ligada → ainda sem sessão.
  return { needsConfirm: true }
}

export async function signOut() {
  const supabase = createClient()

  // Faz logout no Supabase (limpa a sessão e cookies)
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Erro ao fazer logout:', error)
  }

  // Limpa cache de todo o app
  revalidatePath('/', 'layout')

  // Redireciona obrigatoriamente para /login
  redirect('/login')
}

export async function getProfile() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}
