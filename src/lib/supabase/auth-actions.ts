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
