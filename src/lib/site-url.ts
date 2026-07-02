/**
 * URL base pública do app — usada nos links de confirmação de e-mail / recuperação (Supabase Auth).
 * Ordem: NEXT_PUBLIC_SITE_URL → NEXT_PUBLIC_VERCEL_URL (https) → http://localhost:3000. Sem barra final.
 */
export function getSiteURL(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : '') ||
    'http://localhost:3000'
  return url.replace(/\/+$/, '')
}
