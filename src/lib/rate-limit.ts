// Rate limiting em memória - máximo 20 requisições por minuto por usuário
const requestCounts = new Map<string, { count: number; resetTime: number }>()

const LIMIT = 20
const WINDOW_MS = 60 * 1000 // 1 minuto

export function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userKey = `rate-limit-${userId}`
  const userData = requestCounts.get(userKey)

  if (!userData || now > userData.resetTime) {
    // Nova janela de tempo
    requestCounts.set(userKey, { count: 1, resetTime: now + WINDOW_MS })
    return true
  }

  // Incrementar contador
  userData.count++
  if (userData.count > LIMIT) {
    return false // Excedeu limite
  }

  return true
}
