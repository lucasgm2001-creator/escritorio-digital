import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas públicas: o usuário chega deslogado. O callback cria a sessão trocando o code;
// recuperação de senha também precisa continuar acessível sem sessão prévia.
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/forgot-password', '/reset-password']

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID()
  const isDev = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net",
    "worker-src 'self' blob:",
    "media-src 'self' blob: https://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const secure = (res: NextResponse) => {
    res.headers.set('Content-Security-Policy', csp)
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.headers.set('X-Content-Type-Options', 'nosniff')
    res.headers.set('X-Frame-Options', 'DENY')
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    if (!isDev) res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    // O app contém dados pessoais/financeiros; respostas não devem ficar em caches compartilhados.
    res.headers.set('Cache-Control', 'private, no-store, max-age=0')
    return res
  }

  const nextResponse = () => NextResponse.next({ request: { headers: requestHeaders } })
  let response = nextResponse()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = nextResponse()
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims valida o JWT LOCALMENTE (chaves ES256 publicadas no JWKS, em cache) e só vai à rede para renovar
  // o token vencido. getUser ia ao servidor de autenticação em TODA requisição — inclusive prefetch e RSC —, uns
  // 130–150 ms por navegação, e o layout repete a checagem de autoridade (getUser) de qualquer jeito.
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? claimsData.claims : null
  const path = request.nextUrl.pathname

  // APIs validam a própria autenticação e devem responder JSON, nunca redirecionar para HTML.
  if (path.startsWith('/api')) {
    return secure(response)
  }

  // Preserva cookies atualizados pelo Supabase ao redirecionar (inclusive rotação de token).
  const redirectTo = (to: string) => {
    const redirectResponse = NextResponse.redirect(new URL(to, request.url))
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return secure(redirectResponse)
  }

  const isPublic = PUBLIC_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))

  if (!user && !isPublic) {
    return redirectTo('/login')
  }

  // Raiz (start_url do app instalado) e /login de quem já entrou vão DIRETO ao Comercial — antes "/" ia para
  // /login e só então para /comercial: dois redirecionamentos (e duas checagens de sessão) ao abrir o app.
  if (user && (path === '/' || path === '/login')) {
    return redirectTo('/comercial')
  }

  return secure(response)
}

export const config = {
  // manifest/sw/offline ficam FORA do login: sem isso o navegador recebia a página de login no lugar do
  // manifest ("Manifest: Syntax error") e o registro do service worker caía num redirecionamento.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
