// Preferências de APARÊNCIA puramente visuais (cliente). Mesma filosofia de theme/a11y:
// localStorage + classe no <html>. NÃO são dados de servidor — preferência local do dispositivo.
// O boot script em layout.tsx aplica 'ui-compact' antes da hidratação (sem flash).

export type Density = 'confortavel' | 'compact'
const KEY = 'ui_density'

export function loadDensity(): Density {
  if (typeof window === 'undefined') return 'confortavel'
  try { return localStorage.getItem(KEY) === 'compact' ? 'compact' : 'confortavel' } catch { return 'confortavel' }
}

export function saveDensity(d: Density) {
  try { localStorage.setItem(KEY, d) } catch { /* ignore */ }
}

export function applyDensity(d: Density) {
  document.documentElement.classList.toggle('ui-compact', d === 'compact')
}
