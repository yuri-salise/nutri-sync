/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // High-Performance Cyber Athletic Theme Tokens
        cyber: {
          black: '#000000',
          dark: '#07080a',
          surface: '#0d1015',
          card: '#12151b',
          'card-hover': '#181c24',
          border: '#1e232d',
          'border-light': '#2a313f',
          lime: '#C8FF00',
          'lime-hover': '#d4ff33',
          green: '#00D26A',
          red: '#F6465D',
          cyan: '#00E5FF',
          amber: '#FFB800',
          muted: '#848E9C',
          text: '#EAECEF',
          pure: '#FFFFFF',
        },
        athletic: {
          bg: '#000000',
          card: '#12151b',
          border: '#1e232d',
          muted: '#848E9C',
          text: '#EAECEF',
          emerald: '#00D26A',
          cyan: '#00E5FF',
          amber: '#FFB800',
          rose: '#F6465D',
          lime: '#C8FF00',
        }
      },
      fontFamily: {
        poppins: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow-lime': '0 0 25px -4px rgba(200, 255, 0, 0.45)',
        'glow-green': '0 0 25px -4px rgba(0, 210, 106, 0.4)',
        'glow-cyan': '0 0 25px -4px rgba(0, 229, 255, 0.4)',
        'glow-amber': '0 0 25px -4px rgba(255, 184, 0, 0.4)',
        'glow-red': '0 0 25px -4px rgba(246, 70, 93, 0.4)',
        'cyber-card': '0 4px 20px -2px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'cyber-hover': '0 8px 30px -4px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(200, 255, 0, 0.25)',
      },
      backgroundImage: {
        'cyber-gradient-primary': 'linear-gradient(135deg, #C8FF00 0%, #00D26A 100%)',
        'cyber-gradient-dark': 'linear-gradient(180deg, #12151b 0%, #07080a 100%)',
        'cyber-gradient-glow': 'radial-gradient(circle at 50% 0%, rgba(200, 255, 0, 0.12) 0%, transparent 70%)',
        'cyber-grid': 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
      }
    },
  },
  plugins: [],
}
