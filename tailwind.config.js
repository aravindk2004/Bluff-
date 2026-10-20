/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a1220',
        plum: { DEFAULT: '#2b1830', deep: '#1c0f20', light: '#4a2a50' },
        felt: { DEFAULT: '#1d6b55', dark: '#124537', light: '#2a8a6e', rim: '#5a2e1c' },
        crimson: { DEFAULT: '#e04848', dark: '#a82a35' },
        mustard: { DEFAULT: '#f5b83d', dark: '#c98a1a' },
        sky: { DEFAULT: '#3fa7e0', dark: '#1f6e9e' },
        cream: { DEFAULT: '#fbf1dc', dark: '#e8d7b4' },
      },
      fontFamily: {
        display: ['"Lilita One"', 'system-ui', 'sans-serif'],
        body: ['Rubik', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        chunky: '0 4px 0 0 rgba(0,0,0,0.45)',
        'chunky-sm': '0 2px 0 0 rgba(0,0,0,0.45)',
        card: '0 3px 0 0 #b9a47c, 0 6px 14px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
