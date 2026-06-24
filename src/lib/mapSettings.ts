// Configurações do Mapa de Clientes (persistidas em localStorage). O mapa lê daqui;
// Configurações > Comercial > Mapa escreve. Mudanças disparam um evento p/ o mapa reagir ao vivo.
export type MapSkin = 'blue' | 'holo' | 'relevo'
export type MapGrouping = 'cidade' | 'estado'
export const MAP_SETTINGS_EVENT = 'ed-map-settings'
const SKIN_KEY = 'ed-map-skin'
const SEP_KEY = 'ed-map-sep'
const GROUPING_KEY = 'ed-map-grouping'

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

// Agrupamento dos LEADS no mapa: 'cidade' (1 pin/lead) ou 'estado' (agregado). Nunca mexido →
// 'estado' no mobile (<1024px) p/ não poluir, 'cidade' no desktop.
export function getMapGrouping(): MapGrouping {
  if (typeof window === 'undefined') return 'cidade'
  const v = localStorage.getItem(GROUPING_KEY)
  if (v === 'cidade' || v === 'estado') return v
  return window.matchMedia('(max-width: 1023px)').matches ? 'estado' : 'cidade'
}
export function setMapGrouping(g: MapGrouping) {
  localStorage.setItem(GROUPING_KEY, g === 'estado' ? 'estado' : 'cidade')
  window.dispatchEvent(new Event(MAP_SETTINGS_EVENT))
}
