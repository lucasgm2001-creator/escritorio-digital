import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/login', '/forgot-password', '/reset-password']
  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Se sem sessão e não está em rota pública, redirecionar para login
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    const redirectResponse = NextResponse.redirect(loginUrl)

    // Garante que o navegador não faz cache dessa resposta
    redirectResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    redirectResponse.headers.set('Pragma', 'no-cache')
    redirectResponse.headers.set('Expires', '0')

    return redirectResponse
  }

  // Se autenticado e tenta acessar /login, redirecionar para /hall
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/hall', request.url))
  }

  // Garante que rotas protegidas não sejam cacheadas
  if (!isPublicRoute && user) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
}
