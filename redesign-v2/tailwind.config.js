/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./redesign-v2/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- Volt (accent/action) ---
        volt: {
          50: "#faffeb",
          100: "#f5ffcc",
          200: "#eaff99",
          300: "#daff66",
          400: "#c4ff1a",
          500: "#a8e600", // primary CTA fill, active UI states
          600: "#7fb300", // preferred for accent text when needed
          700: "#5c8000", // fallback for small text contrast
        },

        // --- Neutrals (editorial gray) ---
        neutral: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
        },

        // --- Semantic ---
        success: { 500: "#22c55e" },
        warn: { 500: "#f59e0b" },
        error: { 500: "#ef4444" },

        // --- "Role tokens" (use these in UI, not raw hex) ---
        // Light mode roles
        role: {
          "bg-primary": "#ffffff",
          "bg-secondary": "#fafafa",
          "bg-surface": "#ffffff",

          "text-primary": "#171717",
          "text-secondary": "#525252",
          "text-tertiary": "#737373",
          "text-muted": "#a3a3a3",

          "border-default": "#e5e5e5",
          "border-subtle": "#f5f5f5",
          "border-strong": "#d4d4d4",
        },

        // Dark mode roles (use via dark: prefix)
        roleDark: {
          "bg-primary": "#0a0a0a",
          "bg-secondary": "#171717",
          "bg-surface": "#262626",

          "text-primary": "#fafafa",
          "text-secondary": "#d4d4d4",

          "border-default": "#404040",
        },
      },

      fontFamily: {
        // Use next/font to load these; see layout.tsx snippet below
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        serifAccent: ["var(--font-serif-accent)", "ui-serif", "Georgia", "serif"],
      },

      boxShadow: {
        // "Print-like" soft shadow
        artifact: "0 10px 30px rgba(0,0,0,0.08)",
        artifactSm: "0 6px 18px rgba(0,0,0,0.08)",
      },

      borderRadius: {
        // Slightly structured, not bubbly
        artifact: "14px",
        artifactSm: "10px",
      },

      ringColor: ({ theme }) => ({
        ...theme('colors'),
        volt: theme('colors.volt.500'),
      }),
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
}
