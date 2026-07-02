import { headers } from 'next/headers'

/**
 * URL base pública do app — usada nos links de confirmação de e-mail do Supabase Auth (→ /auth/callback).
 * Prioridade:
 *   1) NEXT_PUBLIC_SITE_URL (config explícita por ambiente na Vercel) — recomendado em produção.
 *   2) origem REAL da requisição (x-forwarded-host/host + proto) — cobre preview/prod/localhost sem env.
 * Sempre sem barra final. Chamar só em contexto de servidor (Server Action / Route Handler).
 */
export function getSiteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (env) return env.replace(/\/+$/, '')
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
