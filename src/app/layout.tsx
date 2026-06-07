import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Space_Grotesk, JetBrains_Mono, Inter } from 'next/font/google'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

// ── Design System "Bento Compacto" ──────────────────────────────────────────
// Space Grotesk → títulos e números de métrica.  JetBrains Mono → valores
// técnicos / labels uppercase / timestamps.  Inter → corpo de leitura.
// Expostas como CSS vars; usadas via font-display/font-tech/font-body. NÃO
// trocam a font-sans global (rollout escopado ao Hall por ora).
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-tech', display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' })

export const metadata: Metadata = {
  title: 'Escritório Digital — DR Growth',
  description: 'Sistema interno DR Growth',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Aplica o tema salvo antes do React hidratar — evita flash de tema errado */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){try{
  var t=localStorage.getItem('theme');
  var h=new Date().getHours();
  var dark=t==='dark'||((!t||t==='auto')&&(h>=18||h<6));
  var el=document.documentElement;
  if(dark){el.classList.add('dark');el.classList.remove('light');}
  else{el.classList.add('light');el.classList.remove('dark');}
}catch(e){}}())
        `}} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
