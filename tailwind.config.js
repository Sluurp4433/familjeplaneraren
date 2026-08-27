/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Varmare familjepalett (grön/salvia) – neutral, byts fritt senare.
        brand: {
          DEFAULT: '#2f6f4f',
          50: '#eef6f1',
          100: '#d6ebe0',
          200: '#aed7c1',
          300: '#7fbd9d',
          400: '#529c78',
          500: '#2f6f4f',
          600: '#255a40',
          700: '#1d4733',
          800: '#163728',
          900: '#0f261c',
        },
        accent: {
          DEFAULT: '#c9772d',
          50: '#fbf1e8',
          100: '#f5ddc6',
          200: '#eabb8e',
          300: '#df9857',
          400: '#d4832f',
          500: '#c9772d',
          600: '#a35f24',
          700: '#7d491c',
          800: '#573314',
          900: '#3a220d',
        },
        // Per-person kalenderfärger – tilldelas personer i M2.
        person: {
          rose: '#e2557b',
          amber: '#e0973a',
          teal: '#2fa0a0',
          indigo: '#5b6ee1',
          violet: '#9c5bd4',
          lime: '#7aa93c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
