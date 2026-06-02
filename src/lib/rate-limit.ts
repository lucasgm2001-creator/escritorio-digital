// Rate limiting em memória - 20 req/min por padrão, configurável por rota.
const requestCounts = new Map<string, { count: number; resetTime: number }>()

const DEFAULT_LIMIT = 20
const DEFAULT_WINDOW_MS = 60 * 1000 // 1 minuto

export interface RateLimitInfo {
  allowed: boolean
  remaining: number
  resetTime: number
}

export interface RateLimitOptions {
  /** Máximo de requisições permitidas na janela. Default: 20. */
  limit?: number
  /** Tamanho da janela em ms. Default: 60_000 (1 min). */
  windowMs?: number
}

/**
 * Verifica o rate limit para um identificador. O `identifier` É a chave do
 * bucket: para isolar uma rota sensível (ex.: verify-password) de outras
 * cotas, prefixe-o (ex.: `verify-password:${userId}`).
 */
export function checkRateLimit(identifier: string, options: RateLimitOptions = {}): RateLimitInfo {
  const limit = options.limit ?? DEFAULT_LIMIT
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const now = Date.now()
  const userKey = `rate-limit-${identifier}`
  const userData = requestCounts.get(userKey)

  if (!userData || now > userData.resetTime) {
    // Nova janela de tempo
    const resetTime = now + windowMs
    requestCounts.set(userKey, { count: 1, resetTime })
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime,
    }
  }

  // Incrementar contador
  userData.count++
  const allowed = userData.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - userData.count),
    resetTime: userData.resetTime,
  }
}
