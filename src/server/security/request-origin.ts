import { NextResponse } from 'next/server'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Bloqueia requisições mutáveis vindas de outra origem. SameSite ajuda, mas esta
 * checagem explícita mantém a proteção mesmo se a política dos cookies mudar.
 */
export function sameOriginError(request: Request): NextResponse | null {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return null

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return NextResponse.json({ error: 'Origem não permitida' }, { status: 403 })
  }

  const origin = request.headers.get('origin')
  if (!origin) {
    // Clientes não-browser autenticados não são usados por estas rotas. Webhooks e
    // crons têm autenticação própria e não chamam este helper.
    return NextResponse.json({ error: 'Origem ausente' }, { status: 403 })
  }

  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Origem não permitida' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Origem inválida' }, { status: 403 })
  }
  return null
}
