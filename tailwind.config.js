/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand color - volt (lime/yellow-green)
        volt: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
          800: '#3f6212',
          900: '#365314',
          DEFAULT: '#84cc16',
        },
        // Brand blue from logo (#609fae)
        brandBlue: {
          50: '#e8f4f6',
          100: '#c5e3e8',
          200: '#9dd0d8',
          300: '#75bdc8',
          400: '#609fae',
          500: '#609fae',
          600: '#4d8a97',
          700: '#3d6f7a',
          800: '#2e545d',
          900: '#1f3a40',
          DEFAULT: '#609fae',
        },
        // Role-based semantic colors for consistent theming
        role: {
          'bg-base': '#ffffff',
          'bg-surface': '#fafafa',
          'bg-hover': '#f5f5f5',
          'text-primary': '#171717',
          'text-secondary': '#737373',
          'text-tertiary': '#a3a3a3',
          'border-default': '#e5e5e5',
          'border-strong': '#d4d4d4',
        },
      },
      borderRadius: {
        'artifact': '14px',
      },
      boxShadow: {
        'artifact': 'var(--artifact-shadow)',
        'glow': '0 0 20px rgba(250, 204, 21, 0.5)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.6s ease-out',
        'slide-up-delay': 'slideUp 0.6s ease-out 0.2s both',
        'fade-in': 'fadeIn 0.8s ease-in-out',
        'fade-in-delay': 'fadeIn 0.8s ease-in-out 0.4s both',
        'zoom-in': 'zoomIn 0.4s ease-out',
        'scale-in': 'scaleIn 0.4s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-volt-slow': 'pulseVoltSlow 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'loading-pulse': 'pulse 1.5s ease-in-out infinite',
        'loading-spin': 'spin 1s linear infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        zoomIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        glow: {
          '0%': { textShadow: '0 0 5px rgba(179, 255, 0, 0.5)' },
          '100%': { textShadow: '0 0 20px rgba(179, 255, 0, 0.8), 0 0 30px rgba(179, 255, 0, 0.4)' },
        },
        pulseVoltSlow: {
          '0%, 100%': { opacity: '0.8', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}
