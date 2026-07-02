'use client'

import { useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Lock, Delete, X } from 'lucide-react'

export function CommissionLockProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
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

// Casca visual comum (cadeado + título + bolinhas + msg + teclado + rodapé).
function PadShell({ title, sub, digits, shake, err, msg, onDigit, onDelete, busy, onClose, footer }: {
  title: string; sub: string; digits: string; shake: boolean; err: string; msg: string
  onDigit: (d: string) => void; onDelete: () => void; busy: boolean; onClose?: () => void; footer?: ReactNode
}) {
  return (
    <div className="relative flex flex-col items-center gap-5 p-6 max-w-sm w-full mx-auto">
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
      {footer}
    </div>
  )
}

/**
 * Desbloqueia a comissão de UM vendedor (verify_seller_box). CHEFE abre qualquer box com o PIN dele;
 * vendedor só a própria (regra no servidor). `sellerId` é o id real do card/relatório.
 */
export function CommissionPinPad({ sellerId, sellerName, onUnlock, onClose }: {
  sellerId: string; sellerName?: string; onUnlock?: () => void; onClose?: () => void
}) {
  const supabase = createClient()
  const [digits, setDigits] = useState('')
  const [err, setErr] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)

  const fail = (m: string) => { setErr(m); setDigits(''); setShake(true); setTimeout(() => setShake(false), 450) }

  const verify = async (pin: string) => {
    if (!sellerId) { fail('Vendedor inválido'); return }
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('verify_seller_box', { target_seller_id: sellerId, pin })
      if (error || data !== true) fail('Código incorreto')
      else onUnlock?.()
    } catch { fail('Erro ao verificar. Tente de novo.') } finally { setBusy(false) }
  }
  const onDigit = (d: string) => {
    if (busy || digits.length >= 4) return
    setErr('')
    const next = digits + d
    setDigits(next)
    if (next.length === 4) verify(next)
  }
  const onDelete = () => { if (!busy) { setErr(''); setDigits(p => p.slice(0, -1)) } }

  return (
    <PadShell
      title={sellerName ? `Comissão de ${sellerName}` : 'Comissão bloqueada'}
      sub="Digite o PIN de 4 dígitos."
      digits={digits} shake={shake} err={err} msg="" busy={busy}
      onDigit={onDigit} onDelete={onDelete} onClose={onClose}
    />
  )
}

/**
 * Altera o PIN do PRÓPRIO usuário logado (set_my_commission_pin): atual → novo → confirma.
 * Nunca compara PIN no cliente.
 */
export function ChangePinPad({ onClose }: { onClose?: () => void }) {
  const supabase = createClient()
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current')
  const [digits, setDigits] = useState('')
  const [curPin, setCurPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)

  const fail = (m: string) => { setErr(m); setDigits(''); setShake(true); setTimeout(() => setShake(false), 450) }

  const complete = async (pin: string) => {
    setErr('')
    if (step === 'current') { setCurPin(pin); setDigits(''); setStep('new'); return }
    if (step === 'new') { setNewPin(pin); setDigits(''); setStep('confirm'); return }
    if (pin !== newPin) { setNewPin(''); setStep('new'); fail('Os códigos novos não batem'); return }
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('set_my_commission_pin', { current_pin: curPin, new_pin: newPin })
      if (error || data !== true) { setStep('current'); setCurPin(''); setNewPin(''); fail('PIN atual incorreto ou novo inválido') }
      else { setStep('current'); setCurPin(''); setNewPin(''); setDigits(''); setMsg('PIN alterado.') }
    } catch { setStep('current'); fail('Erro ao alterar. Tente de novo.') } finally { setBusy(false) }
  }
  const onDigit = (d: string) => {
    if (busy || digits.length >= 4) return
    setErr(''); setMsg('')
    const next = digits + d
    setDigits(next)
    if (next.length === 4) complete(next)
  }
  const onDelete = () => { if (!busy) { setErr(''); setDigits(p => p.slice(0, -1)) } }

  const title = step === 'current' ? 'Digite seu PIN atual' : step === 'new' ? 'Novo PIN (4 dígitos)' : 'Confirme o novo PIN'

  return (
    <PadShell
      title={title} sub="Alterar meu PIN"
      digits={digits} shake={shake} err={err} msg={msg} busy={busy}
      onDigit={onDigit} onDelete={onDelete} onClose={onClose}
    />
  )
}
