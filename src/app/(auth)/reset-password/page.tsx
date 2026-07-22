'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updatePassword } from '@/lib/supabase/auth-actions'
import { BrandMark } from '@/components/brand/BrandMark'

// Chegada esperada: via /auth/callback?next=/reset-password (recuperação), que já trocou o code por uma
// sessão de recuperação. Aqui o usuário define a nova senha (updateUser). Sem sessão → erro amigável.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    if (password.length < 12) { setError('Senha fraca — use ao menos 12 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true); setError('')
    try {
      const res = await updatePassword(password)
      if (res?.error) { setError(res.error); setLoading(false) }
      else { setDone(true); setTimeout(() => { router.push('/mesa') }, 1200) }
    } catch {
      setError('Erro inesperado. Tente novamente.'); setLoading(false)
    }
  }

  return (
    <main className="h-[100dvh] overflow-y-auto bg-gradient-to-br from-[#080D0A] via-[#0D140F] to-[#111A14] flex items-center justify-center p-4 py-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <BrandMark size={72} decorative className="mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-1">Definir nova senha</h1>
          <p className="text-lime-fg">Escolha uma senha para sua conta.</p>
        </div>

        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 shadow-2xl">
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-white/90 text-sm">Senha atualizada com sucesso. Entrando…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">Nova senha</label>
                <div className="relative">
                  <input
                    id="password" type={show ? 'text' : 'password'} value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="••••••••"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-lime/60 pr-16 transition-colors"
                    disabled={loading} required
                  />
                  <button type="button" onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/60 hover:text-white transition-colors">
                    {show ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-white/90 mb-2">Confirmar senha</label>
                <input
                  id="confirm" type={show ? 'text' : 'password'} value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-lime/60 transition-colors"
                  disabled={loading} required
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/30 rounded-lg p-3">{error}</p>
              )}

              <button
                type="submit" disabled={loading || !password || !confirm}
                className="w-full bg-lime text-lime-ink font-semibold rounded-xl py-3 hover:bg-lime-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <span className="w-5 h-5 border-2 border-lime-ink/30 border-t-lime-ink rounded-full animate-spin" /> : 'Salvar nova senha'}
              </button>
            </form>
          )}

          <p className="text-center text-white/60 text-sm mt-6">
            <Link href="/login" className="text-lime-fg hover:text-lime font-semibold transition-colors">Voltar para o login</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
