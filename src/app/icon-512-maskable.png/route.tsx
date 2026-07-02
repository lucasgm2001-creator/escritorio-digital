import { ImageResponse } from 'next/og'
import { appIconElement } from '@/components/brand/appIconElement'

// Ícone PWA 512×512 maskable (manifest, purpose "maskable"): mais respiro + fundo full-bleed p/ o
// recorte adaptativo do sistema. PNG gerado no build via next-og.
export function GET() {
  return new ImageResponse(appIconElement(512, { maskable: true }), { width: 512, height: 512 })
}
