/** CaseLink palette — warm "ember & paper": a saffron-orange primary on
 *  warm off-white surfaces, with muted teal / plum for bureau identity and
 *  reserved status colours. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ember: {
          50: '#FFF6EE',
          100: '#FFE9D5',
          200: '#FFD0A6',
          300: '#FFAF6E',
          400: '#FF8C3F',
          500: '#F26C1F',
          600: '#DB540E',
          700: '#B4420C',
          800: '#8D3511',
          900: '#6F2D12',
          950: '#3D1607',
        },
        paper: {
          DEFAULT: '#FFFBF6',
          soft: '#FFF4E8',
          line: '#F0E2D2',
          deep: '#F7E9DA',
        },
        ink: {
          DEFAULT: '#231B16',
          soft: '#4A3F38',
          muted: '#7A6D64',
          faint: '#A99B91',
        },
        teal: { 50: '#E6F5F6', 100: '#C9EBED', 500: '#00939E', 600: '#007C86', 700: '#0B5E66' },
        plum: { 50: '#F3EEF7', 100: '#E5DBEF', 500: '#7A5A9A', 600: '#664A85', 700: '#58407A' },
        sage: { 50: '#EDF6F0', 100: '#D3EADB', 500: '#3F8F5B', 700: '#2C6A42' },
        honey: { 50: '#FFF7E0', 100: '#FDEBB8', 500: '#C98A0B', 700: '#8F6206' },
        rosewood: { 50: '#FCEDEA', 100: '#F7D3CC', 500: '#C2412D', 700: '#912E1F' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'Segoe UI', 'sans-serif'],
        hindi: ['"Noto Sans Devanagari"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(35,27,22,0.04), 0 10px 30px -18px rgba(180,66,12,0.28)',
        lift: '0 2px 0 rgba(35,27,22,0.04), 0 22px 40px -22px rgba(180,66,12,0.45)',
        glow: '0 0 0 4px rgba(242,108,31,0.15)',
      },
      borderRadius: {
        xl2: '1.125rem',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        floaty: 'floaty 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
