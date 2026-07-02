import { ImageResponse } from 'next/og'
import { appIconElement } from '@/components/brand/appIconElement'

// Ícone PWA 192×192 (manifest, purpose "any"). PNG gerado no build via next-og.
export function GET() {
  return new ImageResponse(appIconElement(192), { width: 192, height: 192 })
}
