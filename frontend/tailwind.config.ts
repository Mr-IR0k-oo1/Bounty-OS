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
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover:   'var(--color-accent-hover)',
          muted:   'var(--color-accent-muted)',
          foreground: '#04100d',
        },
        // shadcn/ui aliases so shared components resolve against the design system
        background:       'var(--color-bg-surface)',
        foreground:       'var(--color-text-primary)',
        card:             'var(--color-bg-elevated)',
        'card-foreground': 'var(--color-text-primary)',
        popover:          'var(--color-bg-elevated)',
        'popover-foreground': 'var(--color-text-primary)',
        muted:            'var(--color-bg-overlay)',
        'muted-foreground': 'var(--color-text-muted)',
        secondary:        'var(--color-bg-subtle)',
        'secondary-foreground': 'var(--color-text-primary)',
        destructive:      'var(--color-critical)',
        'destructive-foreground': '#ffffff',
        input:            'var(--color-border)',
        ring:             'var(--color-primary)',
        success:          'var(--color-success)',
        warning:          'var(--color-warning)',
        danger:           'var(--color-danger)',
        neutral:          'var(--color-neutral)',
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
  plugins: [require('@tailwindcss/typography'), require('tailwindcss-animate')],
}

export default config
