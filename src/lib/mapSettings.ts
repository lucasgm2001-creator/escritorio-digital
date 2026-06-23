// Configurações do Mapa de Clientes (persistidas em localStorage). O mapa lê daqui;
// Configurações > Comercial > Mapa escreve. Mudanças disparam um evento p/ o mapa reagir ao vivo.
export type MapSkin = 'blue' | 'holo' | 'relevo'
export const MAP_SETTINGS_EVENT = 'ed-map-settings'
const SKIN_KEY = 'ed-map-skin'
const SEP_KEY = 'ed-map-sep'

export function getMapSkin(): MapSkin {
  if (typeof window === 'undefined') return 'blue'
  const v = localStorage.getItem(SKIN_KEY)
  return v === 'holo' || v === 'relevo' ? v : 'blue'   // padrão Blueprint
}
export function getMapSep(): number {
  if (typeof window === 'undefined') return 4
  return localStorage.getItem(SEP_KEY) === '16' ? 16 : 4   // padrão Justo
}
export function setMapSkin(s: MapSkin) {
  localStorage.setItem(SKIN_KEY, s)
  window.dispatchEvent(new Event(MAP_SETTINGS_EVENT))
}
export function setMapSep(n: number) {
  localStorage.setItem(SEP_KEY, String(n === 16 ? 16 : 4))
  window.dispatchEvent(new Event(MAP_SETTINGS_EVENT))
}
