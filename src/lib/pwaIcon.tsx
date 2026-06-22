import { ImageResponse } from 'next/og'

// Ícone do PWA gerado em runtime (sem sharp/asset): fundo escuro do tema + marca "ED" em lime.
// Placeholder — pode ser trocado por um logo definitivo depois (ver resumo). `maskable` deixa
// uma safe-area (Android recorta em círculo/squircle).
export function renderIcon(size: number, maskable = false): ImageResponse {
  const pad = maskable ? Math.round(size * 0.14) : 0
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: '#0D140F',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: size - 2 * pad, height: size - 2 * pad,
            color: '#C2F73A', fontSize: Math.round(size * 0.42), fontWeight: 800,
            letterSpacing: -Math.round(size * 0.02), fontFamily: 'sans-serif',
          }}
        >
          ED
        </div>
      </div>
    ),
    { width: size, height: size },
  )
}
