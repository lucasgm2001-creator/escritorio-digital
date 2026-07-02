import { ImageResponse } from 'next/og'
import { appIconElement } from '@/components/brand/appIconElement'

// Ícone PWA 512×512 (manifest, purpose "any"). PNG gerado no build via next-og.
export function GET() {
  return new ImageResponse(appIconElement(512), { width: 512, height: 512 })
}
