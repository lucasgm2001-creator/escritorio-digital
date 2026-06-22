import { renderIcon } from '@/lib/pwaIcon'

export const runtime = 'nodejs'

export function GET() {
  return renderIcon(512, true)
}
