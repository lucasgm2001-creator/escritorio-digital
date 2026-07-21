import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas públicas: o usuário chega deslogado. O callback cria a sessão trocando o code;
// recuperação de senha também precisa continuar acessível sem sessão prévia.
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/forgot-password', '/reset-password']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // APIs validam a própria autenticação e devem responder JSON, nunca redirecionar para HTML.
  if (path.startsWith('/api')) {
    return response
  }

  // Preserva cookies atualizados pelo Supabase ao redirecionar (inclusive rotação de token).
  const redirectTo = (to: string) => {
    const redirectResponse = NextResponse.redirect(new URL(to, request.url))
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  const isPublic = PUBLIC_ROUTES.some((route) => path.startsWith(route))

  if (!user && !isPublic) {
    return redirectTo('/login')
  }

  if (user && path === '/login') {
    return redirectTo('/hall')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
