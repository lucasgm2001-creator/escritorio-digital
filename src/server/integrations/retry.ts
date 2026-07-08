import 'server-only'

export type RetryPolicy = {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  multiplier: number
}

export const DEFAULT_INTEGRATION_RETRY: RetryPolicy = {
  maxAttempts: 5,
  initialDelayMs: 1_000,
  maxDelayMs: 60_000,
  multiplier: 2,
}

export function backoffDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_INTEGRATION_RETRY): number {
  const exponent = Math.max(0, attempt - 1)
  const delay = policy.initialDelayMs * Math.pow(policy.multiplier, exponent)
  return Math.min(delay, policy.maxDelayMs)
}
