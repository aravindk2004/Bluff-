/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b1b2a',
        slate: { DEFAULT: '#3b4b50', dark: '#253236', deep: '#1a2427', edge: '#5d7277' },
        blue: { DEFAULT: '#2d8ff0', dark: '#1a5ea6' },
        red: { DEFAULT: '#f0503f', dark: '#a3302a' },
        orange: { DEFAULT: '#ee7d17', dark: '#a3530a' },
        gold: { DEFAULT: '#ffcc3d', dark: '#b88a12' },
        green: { DEFAULT: '#3aa86b', dark: '#22704a' },
        purple: { DEFAULT: '#8b5cd6', dark: '#5a3698' },
        paper: { DEFAULT: '#f6f1e7', edge: '#cfc6b5' },
      },
      screens: {
        // Small phones in portrait (iPhone SE, compact Androids).
        cramped: { raw: '(max-width: 639px) and (max-height: 760px)' },
        // Phones held sideways.
        short: { raw: '(max-height: 500px)' },
      },
      fontFamily: {
        pixel: ['"Jersey 10"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
