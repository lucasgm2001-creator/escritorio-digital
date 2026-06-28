'use client'
import { useEffect, useRef } from 'react'

// Comportamento padrão de DIÁLOGO acessível, reutilizável em todos os overlays (menos WonPlanModal, à parte):
//  • ESC fecha (só o diálogo do TOPO da pilha — modais aninhados não fecham todos juntos).
//  • Focus-trap: Tab / Shift+Tab circulam SÓ dentro do diálogo.
//  • Foco inicial no 1º focável (respeita autoFocus já aplicado) e RETORNA ao abridor ao fechar.
//  • Scroll-lock do body enquanto aberto (fundo não rola atrás no mobile) — M12.
// Uso: const { ref, dialogProps } = useDialog(onClose)
//      <div ref={ref} {...dialogProps} aria-labelledby="id-do-titulo"> … </div>
// (o hook garante role="dialog" + aria-modal + tabindex=-1 no nó; aria-labelledby fica com quem usa.)

const SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Pilha de diálogos abertos (símbolos). Só o do topo responde a ESC/Tab → suporta modais aninhados.
const stack: symbol[] = []

export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const id = Symbol('dialog')
    stack.push(id)
    const isTop = () => stack[stack.length - 1] === id

    const opener = (document.activeElement as HTMLElement | null) ?? null
    const node = ref.current
    if (node) {
      node.setAttribute('role', 'dialog')
      node.setAttribute('aria-modal', 'true')
      if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1')
    }

    const focusables = (): HTMLElement[] =>
      node ? Array.from(node.querySelectorAll<HTMLElement>(SELECTOR)).filter(el => el.getClientRects().length > 0) : []

    // Foco inicial: só se o foco ainda não estiver dentro (não rouba de um autoFocus já aplicado).
    if (node && !node.contains(document.activeElement)) {
      const f = focusables()
      ;(f[0] ?? node).focus?.()
    }

    // Scroll-lock do body (preserva o valor anterior p/ restaurar certo mesmo com modais aninhados).
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (!isTop() || !node) return
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const f = focusables()
      if (f.length === 0) { e.preventDefault(); node.focus?.(); return }
      const first = f[0], last = f[f.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) { e.preventDefault(); last.focus() }
      } else {
        if (active === last || !node.contains(active)) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      const i = stack.indexOf(id); if (i >= 0) stack.splice(i, 1)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()   // retorna o foco a quem abriu
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ref, dialogProps: { role: 'dialog' as const, 'aria-modal': true } }
}
