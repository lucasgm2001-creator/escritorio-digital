// Elemento (Satori / next-og ImageResponse) do símbolo oficial "O Módulo Ativo", usado para gerar os
// PNGs de app/PWA (apple-touch, 192, 512, maskable) NO BUILD, sem ferramenta externa de rasterização.
// Módulo ativo (lima) SEMPRE no topo-esquerdo · fundo do tile #111315 · sem gradiente/glow.
// maskable = mais respiro (safe-zone) e fundo full-bleed para o recorte adaptativo do sistema.
// Fonte de verdade: manual "Escritório Digital — Marca Final".
import type { ReactElement } from 'react'

export function appIconElement(px: number, opts: { maskable?: boolean } = {}): ReactElement {
  const pad = opts.maskable ? 0.26 : 0.16          // respiro externo (fração do lado)
  const gap = Math.round(px * 0.055)               // vão entre módulos
  const content = px - Math.round(px * pad) * 2
  const mod = Math.round((content - gap) / 2)      // lado de cada módulo
  const radius = Math.round(mod * 0.28)            // squircle
  const INACTIVE = '#464D55'                        // usos >=48px → cor de inativo padrão
  const cell = (bg: string) => ({ width: mod, height: mod, borderRadius: radius, background: bg, display: 'flex' })
  return (
    <div style={{ width: px, height: px, background: '#111315', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        <div style={{ display: 'flex', gap }}>
          <div style={cell('#B8FF2C')} />
          <div style={cell(INACTIVE)} />
        </div>
        <div style={{ display: 'flex', gap }}>
          <div style={cell(INACTIVE)} />
          <div style={cell(INACTIVE)} />
        </div>
      </div>
    </div>
  )
}
