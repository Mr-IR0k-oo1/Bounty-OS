import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base:     'var(--color-bg-base)',
          surface:  'var(--color-bg-surface)',
          elevated: 'var(--color-bg-elevated)',
          overlay:  'var(--color-bg-overlay)',
          subtle:   'var(--color-bg-subtle)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          subtle:  'var(--color-border-subtle)',
          strong:  'var(--color-border-strong)',
        },
        text: {
          primary:   'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted:     'var(--color-text-muted)',
          subtle:    'var(--color-text-subtle)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover:   'var(--color-primary-hover)',
          muted:   'var(--color-primary-muted)',
          border:  'var(--color-primary-border)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover:   'var(--color-accent-hover)',
          muted:   'var(--color-accent-muted)',
        },
        severity: {
          critical: 'var(--color-critical)',
          high:     'var(--color-high)',
          medium:   'var(--color-medium)',
          low:      'var(--color-low)',
          info:     'var(--color-info)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm:            'var(--shadow-sm)',
        md:            'var(--shadow-md)',
        lg:            'var(--shadow-lg)',
        'glow-primary': 'var(--shadow-glow-primary)',
        'glow-critical': 'var(--shadow-glow-critical)',
      },
      transitionProperty: {
        DEFAULT: 'var(--transition-base)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
