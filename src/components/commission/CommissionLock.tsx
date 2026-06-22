'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Lock, Delete, KeyRound, X } from 'lucide-react'

// ── Estado de desbloqueio da COMISSÃO — EM MEMÓRIA (React). Reload => volta trancado. ──
// Nada de localStorage/sessionStorage. O PIN NUNCA é comparado/guardado aqui — só via RPC.
type Ctx = { unlocked: boolean; setUnlocked: (v: boolean) => void }
const CommissionLockContext = createContext<Ctx | null>(null)

export function CommissionLockProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  return <CommissionLockContext.Provider value={{ unlocked, setUnlocked }}>{children}</CommissionLockContext.Provider>
}

export function useCommissionLock(): Ctx {
  const c = useContext(CommissionLockContext)
  // Fallback seguro: sem provider → considera TRANCADO.
  return c ?? { unlocked: false, setUnlocked: () => {} }
}

// ── Bolinhas (4 dígitos) ──
function Dots({ n, shake }: { n: number; shake: boolean }) {
  return (
    <div className={cn('flex gap-3.5 justify-center', shake && 'animate-ed-shake')}>
      {[0, 1, 2, 3].map(i => (
        <span key={i} className={cn('w-3.5 h-3.5 rounded-full border-2 transition-colors',
          i < n ? 'bg-lime border-lime' : 'border-bento-border')} />
      ))}
    </div>
  )
}

// ── Teclado numérico ──
function KeyBtn({ children, onClick, disabled, label }: { children: ReactNode; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className="h-14 rounded-2xl border border-bento-border bg-bento-panel text-xl font-display font-semibold text-bento-text flex items-center justify-center hover:border-lime/50 active:scale-95 transition-transform disabled:opacity-50">
      {children}
    </button>
  )
}
function Keypad({ onDigit, onDelete, disabled }: { onDigit: (d: string) => void; onDelete: () => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mx-auto">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
        <KeyBtn key={d} onClick={() => onDigit(d)} disabled={disabled}>{d}</KeyBtn>
      ))}
      <div />
      <KeyBtn onClick={() => onDigit('0')} disabled={disabled}>0</KeyBtn>
      <KeyBtn onClick={onDelete} disabled={disabled} label="Apagar"><Delete className="w-5 h-5" /></KeyBtn>
    </div>
  )
}

/**
 * Teclado de PIN da Comissão. Modo "unlock" (verifica e desbloqueia a sessão) e "change"
 * (PIN atual → novo → confirma). SEMPRE via RPC (verify_commission_pin / set_commission_pin) —
 * nunca compara/exibe PIN no cliente. `onUnlock`/`onClose` p/ uso em modal (ex.: Relatório).
 */
export function CommissionPinPad({ onUnlock, onClose, fullArea }: { onUnlock?: () => void; onClose?: () => void; fullArea?: boolean }) {
  const { setUnlocked } = useCommissionLock()
  const supabase = createClient()
  const [mode, setMode] = useState<'unlock' | 'change'>('unlock')
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current')
  const [digits, setDigits] = useState('')
  const [curPin, setCurPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)

  const fail = (m: string) => { setErr(m); setDigits(''); setShake(true); setTimeout(() => setShake(false), 450) }

  const handleComplete = async (pin: string) => {
    if (mode === 'unlock') {
      setBusy(true)
      try {
        const { data, error } = await supabase.rpc('verify_commission_pin', { pin })
        if (error || data !== true) fail('Código incorreto')
        else { setUnlocked(true); onUnlock?.() }
      } catch { fail('Erro ao verificar. Tente de novo.') } finally { setBusy(false) }
      return
    }
    // Troca de PIN
    if (step === 'current') { setCurPin(pin); setDigits(''); setStep('new'); return }
    if (step === 'new') { setNewPin(pin); setDigits(''); setStep('confirm'); return }
    if (pin !== newPin) { setNewPin(''); setStep('new'); fail('Os códigos novos não batem') ; return }
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('set_commission_pin', { current_pin: curPin, new_pin: newPin })
      if (error || data !== true) { setStep('current'); setCurPin(''); setNewPin(''); fail('PIN atual incorreto ou novo inválido') }
      else {
        setMode('unlock'); setStep('current'); setCurPin(''); setNewPin(''); setDigits(''); setErr('')
        setMsg('PIN alterado.')
      }
    } catch { setStep('current'); fail('Erro ao alterar. Tente de novo.') } finally { setBusy(false) }
  }

  const onDigit = (d: string) => {
    if (busy || digits.length >= 4) return
    setErr(''); setMsg('')
    const next = digits + d
    setDigits(next)
    if (next.length === 4) handleComplete(next)
  }
  const onDelete = () => { if (!busy) { setErr(''); setDigits(prev => prev.slice(0, -1)) } }

  const title = mode === 'unlock' ? 'Comissões bloqueadas'
    : step === 'current' ? 'Digite o PIN atual'
    : step === 'new' ? 'Novo PIN (4 dígitos)'
    : 'Confirme o novo PIN'
  const sub = mode === 'unlock' ? 'Digite o PIN de 4 dígitos para ver as comissões.' : 'Alteração de PIN'

  return (
    <div className={cn('relative flex flex-col items-center gap-5 p-6 max-w-sm mx-auto', fullArea && 'min-h-[60vh] justify-center')}>
      {onClose && (
        <button onClick={onClose} aria-label="Fechar" className="absolute top-2 right-2 p-1.5 rounded-lg text-bento-muted hover:text-bento-text hover:bg-bento-bg transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="w-12 h-12 rounded-2xl bg-lime/15 flex items-center justify-center">
        <Lock className="w-6 h-6 text-lime-fg" />
      </div>
      <div className="text-center">
        <h3 className="font-display font-bold text-bento-text text-base">{title}</h3>
        <p className="text-xs text-bento-muted mt-0.5">{sub}</p>
      </div>

      <Dots n={digits.length} shake={shake} />
      <div className="h-4 text-center">
        {err && <p className="text-red-400 text-xs">{err}</p>}
        {msg && <p className="text-lime-fg text-xs">{msg}</p>}
      </div>

      <Keypad onDigit={onDigit} onDelete={onDelete} disabled={busy} />

      {mode === 'unlock' ? (
        <button type="button" onClick={() => { setMode('change'); setStep('current'); setDigits(''); setErr(''); setMsg('') }}
          className="inline-flex items-center gap-1.5 font-tech text-[11px] uppercase tracking-wide text-bento-muted hover:text-lime-fg transition-colors">
          <KeyRound className="w-3.5 h-3.5" /> Alterar PIN
        </button>
      ) : (
        <button type="button" onClick={() => { setMode('unlock'); setStep('current'); setDigits(''); setCurPin(''); setNewPin(''); setErr('') }}
          className="font-tech text-[11px] uppercase tracking-wide text-bento-muted hover:text-bento-text transition-colors">
          Cancelar
        </button>
      )}
    </div>
  )
}

// Porta: quando TRANCADO mostra o teclado (children — ex.: VendedoresTab — só montam após desbloquear,
// então nenhum valor de comissão é buscado/renderizado antes).
export function CommissionGate({ children }: { children: ReactNode }) {
  const { unlocked } = useCommissionLock()
  if (!unlocked) {
    return (
      <div className="h-full overflow-auto bg-bento-bg">
        <CommissionPinPad fullArea />
      </div>
    )
  }
  return <>{children}</>
}
