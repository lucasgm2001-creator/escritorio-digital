'use server'

import { getRequestContext } from '@/server/context/request-context'
import { can } from '@/lib/permissions/can'
import { createClient } from '@/lib/supabase/server'

// Escrita da LOGO do sistema (branding do workspace — PERMISSIONS-005). É configuração de workspace, então
// exige ADMIN do módulo Configurações: can(settings,'manage') (só owner/admin, no modelo de níveis). O id do
// perfil vem do contexto (servidor), nunca da UI. O upload do arquivo segue client-side (storage). Só grava a URL.
type WriteError = { message: string } | null

export async function updateSystemLogoAction(logoUrl: string): Promise<{ error: WriteError }> {
  const context = await getRequestContext()
  if (!context) return { error: { message: 'Sessão expirada. Entre novamente.' } }
  if (!can(context, 'settings', 'manage')) return { error: { message: 'Apenas owner/admin podem alterar a logo do sistema.' } }
  const supabase = createClient()
  const { error } = await supabase.from('profiles').update({ logo_url: logoUrl }).eq('id', context.user.id)
  return { error: error ? { message: error.message } : null }
}
