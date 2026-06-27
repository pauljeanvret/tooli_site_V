/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '320px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        '3xl': '1920px',
        '4xl': '2560px',
      },
      colors: {
        // Theme-aware Toolia color tokens.
        'toolia-primary': 'rgb(var(--toolia-primary) / <alpha-value>)',
        'toolia-primary-light': 'rgb(var(--toolia-primary-light) / <alpha-value>)',
        'toolia-primary-dark': 'rgb(var(--toolia-primary-dark) / <alpha-value>)',
        
        // Brand depth tokens.
        'toolia-gradient-dark': 'rgb(var(--toolia-gradient-dark) / <alpha-value>)',
        'toolia-gradient-light': 'rgb(var(--toolia-gradient-light) / <alpha-value>)',
        
        // Backgrounds
        'toolia-bg-main': 'rgb(var(--toolia-bg-main) / <alpha-value>)',
        'toolia-bg-secondary': 'rgb(var(--toolia-bg-secondary) / <alpha-value>)',
        'toolia-bg-section': 'rgb(var(--toolia-bg-section) / <alpha-value>)',
        
        // Cards & Surfaces
        'toolia-card': 'rgb(var(--toolia-card) / <alpha-value>)',
        'toolia-card-hover': 'rgb(var(--toolia-card-hover) / <alpha-value>)',
        
        // Borders
        'toolia-border-subtle': 'rgb(var(--toolia-border-subtle) / <alpha-value>)',
        'toolia-border': 'rgb(var(--toolia-border) / <alpha-value>)',
        
        // Text
        'toolia-text': 'rgb(var(--toolia-text) / <alpha-value>)',
        'toolia-text-secondary': 'rgb(var(--toolia-text-secondary) / <alpha-value>)',
        'toolia-text-muted': 'rgb(var(--toolia-text-muted) / <alpha-value>)',
        
        // Status colors
        'toolia-success': 'rgb(var(--toolia-success) / <alpha-value>)',
        'toolia-warning': 'rgb(var(--toolia-warning) / <alpha-value>)',
        'toolia-danger': 'rgb(var(--toolia-danger) / <alpha-value>)',
        'toolia-info': 'rgb(var(--toolia-info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'h1-desktop': '64px',
        'h1-mobile': '44px',
        'h2-desktop': '40px',
        'h2-mobile': '32px',
        'body': '18px',
        'body-sm': '16px',
      },
      letterSpacing: {
        'tight-h1': '-0.03em',
        'tight-h2': '-0.02em',
      },
      maxWidth: {
        'layout': '1440px',
        'screen-2xl': '1536px',
        'screen-3xl': '1920px',
        'screen-4xl': '2560px',
      },
      spacing: {
        'gutter': '24px',
        'section-desktop': '96px',
        'section-tablet': '72px',
        'section-mobile': '56px',
      },
      borderRadius: {
        'card': '20px',
        'btn': '999px',
      },
      boxShadow: {
        'soft': 'var(--toolia-shadow-soft)',
        'btn-primary': 'var(--toolia-shadow-btn-primary)',
        'btn-hover': 'var(--toolia-shadow-btn-hover)',
        'glow-primary': 'var(--toolia-shadow-glow-primary)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.55s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(6px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'fade-in': {
          'from': { opacity: '0', transform: 'translateY(12px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        'navbar': '12px',
      },
    },
  },
  plugins: [],
}
