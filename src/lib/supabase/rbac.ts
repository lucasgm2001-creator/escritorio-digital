import { redirect } from 'next/navigation'
import { createClient } from './server'

export type Role = 'admin' | 'comercial' | 'trafego' | 'financeiro'

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ['/hall', '/comercial', '/clientes', '/trafego', '/financeiro', '/administrativo', '/configuracoes'],
  comercial: ['/hall', '/comercial', '/clientes'],
  trafego: ['/hall', '/trafego'],
  financeiro: ['/hall', '/financeiro'],
}

export async function getProfileWithRole() {
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

export async function verifyRouteAccess(pathname: string) {
  const profile = await getProfileWithRole()
  if (!profile) redirect('/login')

  const role = profile.role as Role
  const allowedRoutes = ROLE_PERMISSIONS[role]

  const hasAccess = allowedRoutes.some(route => {
    if (route === pathname) return true
    if (route === '/hall' && pathname === '/') return true
    return pathname.startsWith(route + '/')
  })

  if (!hasAccess) {
    redirect('/hall')
  }

  return profile
}
