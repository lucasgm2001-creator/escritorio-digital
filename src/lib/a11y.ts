// Acessibilidade — preferências CLIENT (localStorage), aplicadas por classe no <html> + CSS
// (ver globals.css). Não toca em servidor/banco. Mesma categoria de preferência do tema.
export type FontScale = 'normal' | 'grande' | 'maior'

export interface A11ySettings {
  font: FontScale
  contrast: boolean
  spacing: boolean
  reduceMotion: boolean
}

export const DEFAULT_A11Y: A11ySettings = { font: 'normal', contrast: false, spacing: false, reduceMotion: false }
const KEY = 'a11y'

export function loadA11y(): A11ySettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_A11Y, ...(JSON.parse(raw) as Partial<A11ySettings>) }
  } catch { /* ignore */ }
  return DEFAULT_A11Y
}

export function saveA11y(s: A11ySettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

export function applyA11y(s: A11ySettings): void {
  const el = document.documentElement
  el.classList.remove('a11y-font-grande', 'a11y-font-maior')
  if (s.font === 'grande') el.classList.add('a11y-font-grande')
  if (s.font === 'maior') el.classList.add('a11y-font-maior')
  el.classList.toggle('a11y-contrast', s.contrast)
  el.classList.toggle('a11y-spacing', s.spacing)
  el.classList.toggle('a11y-reduce-motion', s.reduceMotion)
}
