/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Soft UI (neumorphism) tokens. Values live as RGB channels in src/index.css
      // so opacity modifiers like bg-accent/10 keep working.
      colors: {
        page: token('page'),
        card: token('card'),
        'card-hover': token('card-hover'),
        well: token('well'),
        line: token('line'),
        'line-strong': token('line-strong'),
        ink: token('ink'),
        soft: token('soft'),
        muted: token('muted'),
        faint: token('faint'),
        accent: token('accent'),
        'accent-hover': token('accent-hover'),
        'on-accent': token('on-accent'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
        violet: token('violet'),
        coral: token('coral'),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        neu: '8px 8px 16px rgb(var(--shade-dark)), -8px -8px 16px rgb(var(--shade-light))',
        'neu-sm': '4px 4px 8px rgb(var(--shade-dark)), -4px -4px 8px rgb(var(--shade-light))',
        'neu-inset': 'inset 5px 5px 10px rgb(var(--shade-dark)), inset -5px -5px 10px rgb(var(--shade-light))',
        'neu-inset-sm': 'inset 3px 3px 6px rgb(var(--shade-dark)), inset -3px -3px 6px rgb(var(--shade-light))',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rise: 'rise 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
