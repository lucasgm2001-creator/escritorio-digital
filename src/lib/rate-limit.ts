import 'server-only'

import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

const DEFAULT_LIMIT = 20
const DEFAULT_WINDOW_MS = 60 * 1000 // 1 minuto

interface RateLimitInfo {
  allowed: boolean
  remaining: number
  resetTime: number
}

interface RateLimitOptions {
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
export async function checkRateLimit(identifier: string, options: RateLimitOptions = {}): Promise<RateLimitInfo> {
  const limit = options.limit ?? DEFAULT_LIMIT
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const keyHash = createHash('sha256').update(`rate-limit:${identifier}`).digest('hex')
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000))
  const { data, error } = await createServiceClient().rpc('consume_rate_limit', {
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error || !data || typeof data !== 'object') {
    console.error('[security] rate limit indisponível:', error?.message ?? 'resposta inválida')
    // Falha fechada: uma indisponibilidade do limitador não libera abuso/consumo de IA.
    return { allowed: false, remaining: 0, resetTime: Date.now() + windowMs }
  }
  const result = data as { allowed?: boolean; remaining?: number; reset_at?: string }
  return {
    allowed: result.allowed === true,
    remaining: Math.max(0, Number(result.remaining) || 0),
    resetTime: Date.parse(result.reset_at ?? '') || Date.now() + windowMs,
  }
}
