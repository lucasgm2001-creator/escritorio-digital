import 'server-only'

import { randomUUID } from 'crypto'
import type { HardenedIntegrationProvider } from './feature-flags'

type LogLevel = 'info' | 'warn' | 'error'

export type IntegrationLogContext = {
  provider: HardenedIntegrationProvider
  requestId?: string
  eventId?: string
  integrationId?: string
  correlationId?: string
  teamId?: string | null
  action?: string
}

type LogMeta = Record<string, unknown>

const SENSITIVE_KEY = /(token|secret|password|authorization|signature|cookie|phone|email|body|message)/i

export function createRequestId(): string {
  return randomUUID()
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (!value || typeof value !== 'object') return value
  const out: LogMeta = {}
  for (const [key, item] of Object.entries(value as LogMeta)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(item)
  }
  return out
}

export function integrationLog(level: LogLevel, context: IntegrationLogContext, message: string, meta?: LogMeta): void {
  const entry = {
    level,
    message,
    at: new Date().toISOString(),
    ...context,
    meta: meta ? redact(meta) : undefined,
  }

  if (level === 'error') {
    console.error('[integration]', entry)
  } else if (level === 'warn') {
    console.warn('[integration]', entry)
  } else {
    console.info('[integration]', entry)
  }
}
