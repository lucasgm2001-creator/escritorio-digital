import type { Metadata } from 'next'
import localFont from 'next/font/local'
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
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
