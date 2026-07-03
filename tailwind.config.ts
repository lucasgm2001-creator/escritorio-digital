import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // DR Growth brand (identity) — fixo nos dois temas
        brand: {
          DEFAULT: '#0f2044',
          900: '#0f2044',
          950: '#09152d',
        },
        // Interactive primary — indigo accent (fixo nos dois temas)
        primary: {
          DEFAULT: '#6366f1',
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        secondary: { DEFAULT: '#8b5cf6', foreground: '#ffffff' },
        // ── Tokens semânticos theme-aware ──
        // Canais RGB definidos em globals.css (:root = dark, html.light = claro).
        // rgb(var() / <alpha-value>) permite modificadores de opacidade (ex: bg-card/50, text-muted-foreground/60).
        background:  'rgb(var(--c-background) / <alpha-value>)',
        foreground:  'rgb(var(--c-foreground) / <alpha-value>)',
        muted:       { DEFAULT: 'rgb(var(--c-muted) / <alpha-value>)',    foreground: 'rgb(var(--c-muted-foreground) / <alpha-value>)' },
        border:      'rgb(var(--c-border) / <alpha-value>)',
        input:       'rgb(var(--c-input) / <alpha-value>)',
        ring:        'rgb(var(--c-ring) / <alpha-value>)',
        card:        { DEFAULT: 'rgb(var(--c-card) / <alpha-value>)',     foreground: 'rgb(var(--c-card-foreground) / <alpha-value>)' },
        popover:     { DEFAULT: 'rgb(var(--c-popover) / <alpha-value>)',  foreground: 'rgb(var(--c-popover-foreground) / <alpha-value>)' },
        accent:      { DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',   foreground: 'rgb(var(--c-accent-foreground) / <alpha-value>)' },
        sidebar: {
          DEFAULT:    'rgb(var(--c-sidebar) / <alpha-value>)',
          foreground: 'rgb(var(--c-sidebar-foreground) / <alpha-value>)',
          muted:      'rgb(var(--c-sidebar-muted) / <alpha-value>)',
          border:     'rgb(var(--c-sidebar-border) / <alpha-value>)',
          accent:     'rgb(var(--c-sidebar-accent) / <alpha-value>)',
        },
        // Status colors — fixos nos dois temas (texto sempre branco sobre eles)
        destructive: { DEFAULT: '#ef4444', foreground: '#ffffff' },  // erro/negativo
        success:     { DEFAULT: '#22c55e', foreground: '#ffffff' },
        warning:     { DEFAULT: '#f5b83d', foreground: '#1a1306' },  // atenção (âmbar)

        // ── Sistema de acento "verde lima" ──
        // Identidade do sistema. Papéis: fill/hover/active/ink + soft (badge +) + border (botão 2º).
        // Tudo theme-aware via --accent-* (dark brilha mais; light usa verde fechado).
        lime: {
          DEFAULT:   'rgb(var(--accent) / <alpha-value>)',
          hover:     'rgb(var(--accent-hover) / <alpha-value>)',
          dim:       'rgb(var(--accent-dim) / <alpha-value>)',
          ink:       'rgb(var(--accent-ink) / <alpha-value>)',
          fg:        'rgb(var(--accent-fg) / <alpha-value>)',
          soft:      'rgb(var(--accent-soft) / <alpha-value>)',
          'soft-fg': 'rgb(var(--accent-soft-fg) / <alpha-value>)',
          border:    'rgb(var(--accent-border) / <alpha-value>)',
        },
        // Neutros bento (theme-aware), isolados dos tokens --c-* legados.
        bento: {
          bg:     'rgb(var(--bento-bg) / <alpha-value>)',
          panel:  'rgb(var(--bento-panel) / <alpha-value>)',
          border: 'rgb(var(--bento-border) / <alpha-value>)',
          text:   'rgb(var(--bento-text) / <alpha-value>)',
          dim:    'rgb(var(--bento-dim) / <alpha-value>)',
          muted:  'rgb(var(--bento-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        // Bento Compacto
        display: ['var(--font-display)', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        tech:    ['var(--font-tech)', 'var(--font-geist-mono)', 'monospace'],
        body:    ['var(--font-body)', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.75rem', md: '0.5rem', sm: '0.375rem',
        // Bento Compacto: painéis 14px, frame de seção 22px, botões 10px
        bento: '14px', frame: '22px', btn: '10px',
      },
      boxShadow: {
        card:        '0 4px 24px rgba(0,0,0,0.35)',
        'card-hover':'0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(182,255,59,0.14)',
        glow:        '0 0 20px rgba(182,255,59,0.30)',
        'glow-sm':   '0 0 10px rgba(182,255,59,0.20)',
        'glow-lg':   '0 0 40px rgba(182,255,59,0.40)',
        inner:       'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'gradient-card':    'linear-gradient(135deg, #17231B 0%, #111A14 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #080D0A 0%, #0D140F 100%)',
        'gradient-primary': 'linear-gradient(135deg, #B6FF3B 0%, #9FEA22 100%)',
        'gradient-hero':    'linear-gradient(135deg, #080D0A 0%, #111A14 100%)',
        'gradient-text':    'linear-gradient(135deg, #B6FF3B 0%, #C8FF63 100%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'count-up':   'countUp 0.5s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'spin':       'spin 1s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,.6,1) infinite',
        'live':       'livePulse 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        countUp:   { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 8px rgba(182,255,59,0.30)' },
          '50%':     { boxShadow: '0 0 18px rgba(182,255,59,0.50)' },
        },
        livePulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
    },
  },
  plugins: [
    // Variante 'coarse:' (IPAD-002) — estilos SÓ em dispositivos de TOQUE (iPad/celular, pointer: coarse).
    // Desktop (mouse, pointer: fine) não recebe → cards maiores/legíveis no iPad sem inchar o desktop.
    plugin(({ addVariant }) => { addVariant('coarse', '@media (pointer: coarse)') }),
  ],
}

export default config
