'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard error]', error)
  }, [error])

  // Não expor mensagens técnicas de erro ao usuário
  const isSensitiveError = (msg: string) => {
    const sensitiveKeywords = ['RLS', 'database', 'SQL', 'policy', 'unauthorized', 'JWT', 'role', 'Supabase']
    return sensitiveKeywords.some(keyword => msg?.includes(keyword))
  }

  const safeMessage = isSensitiveError(error?.message || '')
    ? 'Ocorreu um erro no sistema. Tente novamente mais tarde.'
    : 'Ocorreu um erro inesperado nesta página.'

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 p-8">
      <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center">
        <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="font-display text-lg font-semibold text-bento-text mb-1">Algo deu errado</h2>
        <p className="text-sm text-bento-muted max-w-sm">{safeMessage}</p>
      </div>
      <button
        onClick={reset}
        className="bento-btn px-4 py-2 rounded-btn text-sm font-medium"
      >
        Tentar novamente
      </button>
    </div>
  )
}
