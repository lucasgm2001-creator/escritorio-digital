'use client'

import { useToast } from '@/components/ui/toast'

interface SaveOpts<T> {
  /** A chamada ao banco OU a uma server action gated — await-ável. O erro só precisa expor `.message`
   *  (o builder do supabase e as actions do PERMISSIONS-004 satisfazem isso). */
  run: () => PromiseLike<{ data?: T | null; error: { message: string } | null }>
  /** Atualização otimista da UI, aplicada ANTES da chamada. */
  optimistic?: () => void
  /** Desfaz a otimista se o banco recusar. */
  rollback?: () => void
  /** Toast de sucesso (opcional). */
  success?: string
  /** Prefixo do toast de erro (ex.: "Não foi possível salvar o cliente"). */
  error?: string
}

/**
 * Helper central de persistência: aplica otimista → await → em erro faz rollback
 * + toast de erro (sem falha silenciosa); em sucesso, toast opcional. Garante que
 * estado local e banco fiquem consistentes.
 *
 * Uso:
 *   const save = useSave()
 *   await save({
 *     optimistic: () => setX(novo),
 *     run: () => supabase.from('t').update({...}).eq('id', id),
 *     rollback: () => setX(antigo),
 *     error: 'Não foi possível salvar',
 *   })
 */
export function useSave() {
  const { toast } = useToast()

  return async function save<T>(opts: SaveOpts<T>): Promise<{ ok: boolean; data?: T | null }> {
    opts.optimistic?.()
    const { data, error } = await opts.run()
    if (error) {
      opts.rollback?.()
      toast({ type: 'error', message: `${opts.error ?? 'Não foi possível salvar'}: ${error.message}` })
      return { ok: false }
    }
    if (opts.success) toast({ type: 'success', message: opts.success })
    return { ok: true, data }
  }
}
