'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from './server'
import { ACTIVE_TEAM_COOKIE } from './team'
import { getSiteURL } from '@/lib/site-url'

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

// Cadastro ABERTO (multi-tenant): qualquer e-mail+senha cria conta. O acesso aos dados é controlado pela
// EQUIPE — a guarda no layout do dashboard manda quem não tem equipe pro /onboarding (criar/entrar em equipe).
export async function signUp(name: string, email: string, password: string) {
  const nm = (name ?? '').trim()
  const em = (email ?? '').trim().toLowerCase()
  if (!nm || !em || !password) return { error: 'Preencha nome, e-mail e senha.' }

  const supabase = createClient()
  // Confirmação de e-mail volta pro DOMÍNIO REAL (não localhost): o link aponta para /auth/callback,
  // que troca o `code` por sessão. A base vem de NEXT_PUBLIC_SITE_URL (fallback = origem da requisição).
  const { data, error } = await supabase.auth.signUp({
    email: em,
    password,
    options: { data: { name: nm }, emailRedirectTo: `${getSiteURL()}/auth/callback` },
  })
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

  // Limpa o cookie da equipe ativa: uma referência antiga não pode interferir no próximo login (troca de
  // conta). getActiveTeam já ignora cookie inválido, mas removê-lo evita lixo entre contas. O logout NÃO
  // depende disso para funcionar — mesmo que falhe, a sessão já foi encerrada acima.
  (await cookies()).delete(ACTIVE_TEAM_COOKIE)

  // Limpa cache de todo o app
  revalidatePath('/', 'layout')

  // Redireciona obrigatoriamente para /login
  redirect('/login')
}

// Recuperação de senha — envia o e-mail com link que volta pelo /auth/callback (troca o code por sessão
// de recuperação) e segue pro /reset-password. Reusa o callback (sem lógica paralela). Não revela se o
// e-mail existe (anti-enumeração): sempre retorna ok.
export async function requestPasswordReset(email: string) {
  const em = (email ?? '').trim().toLowerCase()
  if (!em) return { error: 'Informe seu e-mail.' }
  const supabase = createClient()
  await supabase.auth.resetPasswordForEmail(em, {
    redirectTo: `${getSiteURL()}/auth/callback?next=/reset-password`,
  })
  return { ok: true as const }
}

// Define a nova senha usando a sessão de recuperação já estabelecida pelo /auth/callback.
export async function updatePassword(password: string) {
  if (!password || password.length < 6) return { error: 'Senha fraca — use ao menos 6 caracteres.' }
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão de recuperação ausente ou expirada. Reenvie o e-mail de recuperação.' }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'Não foi possível atualizar a senha. Tente novamente.' }
  return { ok: true as const }
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
