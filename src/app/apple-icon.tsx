import { ImageResponse } from 'next/og'
import { appIconElement } from '@/components/brand/appIconElement'

// Ícone Apple (adicionar à tela inicial no iPhone/iPad). PNG 180×180 gerado no build via next-og.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(appIconElement(180), { ...size })
}
