/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Map "secondary" to a custom dark gray palette - WCAG AA compliant
        secondary: {
          50:  "#f7f8fa",
          100: "#eef1f5",
          200: "#d9dee7",
          300: "#d1d9e6", // Lightened from #b9c0cf for better contrast (4.5:1 on dark backgrounds)
          400: "#a8b5c8", // Lightened from #8e99b1 for better contrast (4.5:1 on dark backgrounds)
          500: "#6b7b97",
          600: "#4f5f7b",
          700: "#3a4861",
          800: "#27324a",   // <– this makes bg-secondary-800 work
          900: "#1a2236",
        },
        // Map "volt" to a bright neon yellow-green palette
        volt: {
          50:  "#fdffe6",
          100: "#f7ffb3",
          200: "#eeff66",
          300: "#e0ff33",
          400: "#ccff0a",
          500: "#b3ff00",   // <– this makes ring-volt-500 work
          600: "#89cc00",
          700: "#669900",
          800: "#4d7300",
          900: "#334d00",
        },
        // Success color palette
        success: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        // Danger color palette
        danger: {
          50:  "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
  ],
}
