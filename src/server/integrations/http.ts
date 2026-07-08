import 'server-only'

import { NextResponse } from 'next/server'
import { IntegrationError } from './errors'
import type { IntegrationLogContext } from './logger'
import { integrationLog } from './logger'

export function integrationJsonError(error: unknown, context: IntegrationLogContext): NextResponse {
  if (error instanceof IntegrationError) {
    integrationLog(error.status >= 500 ? 'warn' : 'info', context, error.message, { code: error.code })
    return NextResponse.json(
      { error: error.message, code: error.code, requestId: context.requestId },
      { status: error.status },
    )
  }

  const message = error instanceof Error ? error.message : 'Erro inesperado na integração.'
  integrationLog('error', context, message)
  return NextResponse.json(
    { error: 'Erro inesperado na integração.', code: 'internal_error', requestId: context.requestId },
    { status: 500 },
  )
}

export function notImplementedJson(provider: string, requestId: string): NextResponse {
  return NextResponse.json(
    {
      error: `${provider} ainda não possui conector de produção.`,
      code: 'not_implemented',
      requestId,
    },
    { status: 501 },
  )
}
