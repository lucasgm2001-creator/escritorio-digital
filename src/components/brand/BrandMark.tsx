// Símbolo oficial do Escritório Digital — "O Módulo Ativo".
// Quatro módulos iguais; o ativo (lima #B8FF2C) fica SEMPRE no canto superior esquerdo.
// Regras da marca: nunca mover o módulo ativo, nunca recolorir os módulos, nunca fundo lima,
// nunca gradiente/glow/neon/3D. Módulos inativos clareiam conforme o tamanho (legibilidade).
// Fonte de verdade: manual "Escritório Digital — Marca Final".

interface BrandMarkProps {
  /** lado do ícone em px (padrão 28) */
  size?: number
  className?: string
  /** desenha o tile #111315 atrás dos módulos (padrão true) */
  tile?: boolean
  /** quando acompanhado de wordmark visível, marca como decorativo p/ leitores de tela */
  decorative?: boolean
}

export function BrandMark({ size = 28, className, tile = true, decorative = false }: BrandMarkProps) {
  // Inativos: >=48px #464D55 · 24–47px #79828D · <24px #8A93A0 (regra de legibilidade da marca).
  const inactive = size >= 48 ? '#464D55' : size >= 24 ? '#79828D' : '#8A93A0'
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': 'Escritório Digital' }
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64" className={className}
      xmlns="http://www.w3.org/2000/svg" {...a11y}
    >
      {tile && <rect width="64" height="64" rx="14" fill="#111315" />}
      <path d="M18.1 10.4 H23.85 A5.75 5.75 0 0 1 29.6 16.15 V25.75 A3.85 3.85 0 0 1 25.75 29.6 H16.15 A5.75 5.75 0 0 1 10.4 23.85 V18.1 A7.7 7.7 0 0 1 18.1 10.4 Z" fill="#B8FF2C" />
      <path d="M40 10 H46 A8 8 0 0 1 54 18 V24 A6 6 0 0 1 48 30 H38 A4 4 0 0 1 34 26 V16 A6 6 0 0 1 40 10 Z" fill={inactive} />
      <path d="M16 34 H26 A4 4 0 0 1 30 38 V48 A6 6 0 0 1 24 54 H18 A8 8 0 0 1 10 46 V40 A6 6 0 0 1 16 34 Z" fill={inactive} />
      <path d="M38 34 H48 A6 6 0 0 1 54 40 V46 A8 8 0 0 1 46 54 H40 A6 6 0 0 1 34 48 V38 A4 4 0 0 1 38 34 Z" fill={inactive} />
    </svg>
  )
}
