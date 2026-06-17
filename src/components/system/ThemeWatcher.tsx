'use client'

import { useOnFocusVisible } from '@/lib/hooks/useOnFocusVisible'

// 'auto' = escuro das 18h às 6h — MESMA regra do script inline do layout e do seletor de
// tema. NÃO há prefers-color-scheme aqui: é por HORÁRIO.
const isDarkByTime = () => { const h = new Date().getHours(); return h >= 18 || h < 6 }

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
  if (dark === html.classList.contains('dark')) return
  if (dark) { html.style.colorScheme = 'dark'; html.classList.add('dark'); html.classList.remove('light') }
  else { html.style.colorScheme = 'light'; html.classList.add('light'); html.classList.remove('dark') }
}

export function ThemeWatcher() {
  // Checa a cada 1 min (vira no horário) + ao focar; aplica também no mount.
  useOnFocusVisible(applyAutoTheme, { intervalMs: 60_000, immediate: true })
  return null
}
