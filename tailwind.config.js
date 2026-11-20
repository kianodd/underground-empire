/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { vazir: ['Vazirmatn', 'system-ui', 'sans-serif'] },
      colors: {
        ink: '#0a0a0f', panel: '#12121a', panel2: '#1a1a26', line: '#26263a',
        neon: '#22ff88', violet2: '#a855f7', warn: '#fb923c', danger: '#f87171',
        cream: '#ececf4', mute: '#9a9ab0',
      },
    },
  },
  plugins: [],
}
