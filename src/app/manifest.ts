import type { MetadataRoute } from 'next'

// Manifest do PWA (Next 14 serve em /manifest.webmanifest e linka automático no <head>).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Escritório Digital',
    short_name: 'Escritório',
    description: 'Sistema interno DR Growth',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0D140F',
    theme_color: '#0D140F',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
