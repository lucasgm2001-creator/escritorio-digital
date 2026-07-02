'use client'

import { useState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/lib/supabase/auth-actions'
import { BrandMark } from '@/components/brand/BrandMark'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')
    try {
      const res = await requestPasswordReset(email)
      if (res?.error) { setError(res.error); setLoading(false) }
      else setSent(true)
    } catch {
      setError('Erro inesperado. Tente novamente.'); setLoading(false)
    }
  }

  return (
    <main className="h-[100dvh] overflow-y-auto bg-gradient-to-br from-[#080D0A] via-[#0D140F] to-[#111A14] flex items-center justify-center p-4 py-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <BrandMark size={72} decorative className="mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-1">Recuperar senha</h1>
          <p className="text-lime-fg">Enviamos um link para redefinir sua senha.</p>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-white/90 text-sm">
                Se existir uma conta com <span className="font-semibold">{email}</span>, você receberá um e-mail
                com o link para redefinir a senha. Confira também o spam.
              </p>
              <Link href="/login" className="inline-block text-lime-fg hover:text-lime font-semibold text-sm transition-colors">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">E-mail</label>
                <input
                  id="email" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="seu@email.com"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-lime/60 transition-colors"
                  disabled={loading} required
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/30 rounded-lg p-3">{error}</p>
              )}

              <button
                type="submit" disabled={loading || !email}
                className="w-full bg-lime text-lime-ink font-semibold rounded-xl py-3 hover:bg-lime-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <span className="w-5 h-5 border-2 border-lime-ink/30 border-t-lime-ink rounded-full animate-spin" /> : 'Enviar link de recuperação'}
              </button>
            </form>
          )}

          <p className="text-center text-white/60 text-sm mt-6">
            Lembrou a senha?{' '}
            <Link href="/login" className="text-lime-fg hover:text-lime font-semibold transition-colors">Entrar</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
