'use client'

import { useOnFocusVisible } from '@/lib/hooks/useOnFocusVisible'
import { isDarkByTime } from '@/lib/theme'

// 'auto' = escuro na janela configurável (default 18h–6h) — MESMA regra do script inline do
// layout e do seletor de tema. NÃO há prefers-color-scheme aqui: é por HORÁRIO.

// Reaplica o tema 'auto' sem refresh: vira escuro/claro sozinho ao cruzar 18h/6h. Manual
// (light/dark fixos) GANHA — não é tocado. Só mexe no <html> quando o estado realmente
// muda → não pisca a tela nem tira o foco de inputs. A preferência já vive em localStorage
// (sistema pré-existente); aqui apenas LEMOS pra respeitar o override manual.
function applyAutoTheme() {
  let pref = 'auto'
  try { pref = localStorage.getItem('theme') || 'auto' } catch { /* ignore */ }
  if (pref !== 'auto') return
  const html = document.documentElement
  const dark = isDarkByTime()
  const hasDark = html.classList.contains('dark')
  const hasLight = html.classList.contains('light')
  // Só mexe no DOM quando o estado NÃO está exatamente certo (cobre o caso de faltar/sobrar classe).
  if (dark ? (hasDark && !hasLight) : (hasLight && !hasDark)) return
  if (dark) { html.style.colorScheme = 'dark'; html.classList.add('dark'); html.classList.remove('light') }
  else { html.style.colorScheme = 'light'; html.classList.add('light'); html.classList.remove('dark') }
}

export function ThemeWatcher() {
  // Vira sozinho ao cruzar 18h/6h: checa a cada 30s enquanto visível + ao focar/voltar a aba; aplica no mount.
  useOnFocusVisible(applyAutoTheme, { intervalMs: 30_000, immediate: true })
  return null
}
