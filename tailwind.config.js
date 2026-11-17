/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      colors: {
        botanical: {
          mauve: '#C88EB0',
          cream: '#E5DFB0',
          lime: '#C7D49C',
          sage: '#8DC180',
          teal: '#85C7AC',
          dark: '#1E2D28',
          surface: '#FAF8F3'
        }
      }
    },
  },
  plugins: [],
};
