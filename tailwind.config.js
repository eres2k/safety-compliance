/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        framework: {
          at: '#ED2939',
          'at-light': '#FEE2E2',
          de: '#FFCC00',
          'de-light': '#FEF3C7',
          nl: '#FF6600',
          'nl-light': '#FFEDD5'
        }
      }
    }
  },
  plugins: []
}
