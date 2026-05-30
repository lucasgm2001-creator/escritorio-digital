import type { Config } from 'tailwindcss'

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
        destructive: { DEFAULT: '#ef4444', foreground: '#ffffff' },
        success:     { DEFAULT: '#22c55e', foreground: '#ffffff' },
        warning:     { DEFAULT: '#f59e0b', foreground: '#ffffff' },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: { lg: '0.75rem', md: '0.5rem', sm: '0.375rem' },
      boxShadow: {
        card:        '0 4px 24px rgba(0,0,0,0.3)',
        'card-hover':'0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.15)',
        glow:        '0 0 20px rgba(99,102,241,0.4)',
        'glow-sm':   '0 0 10px rgba(99,102,241,0.25)',
        'glow-lg':   '0 0 40px rgba(99,102,241,0.5)',
        inner:       'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'gradient-card':    'linear-gradient(135deg, #161b27 0%, #1a2035 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #0f1117 0%, #131620 100%)',
        'gradient-primary': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        'gradient-hero':    'linear-gradient(135deg, #0d1117 0%, #161b27 100%)',
        'gradient-text':    'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'count-up':   'countUp 0.5s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'spin':       'spin 1s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,.6,1) infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        countUp:   { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 8px rgba(99,102,241,0.35)' },
          '50%':     { boxShadow: '0 0 20px rgba(99,102,241,0.6)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
