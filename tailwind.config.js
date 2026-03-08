/** @type {import('tailwindcss').Config} */
module.exports = {
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
        // Primary brand colors from logo
        'toolia-primary': '#1F2A4D',
        'toolia-primary-light': '#3A4A7F',
        'toolia-primary-dark': '#151E38',
        
        // Logo gradient stops
        'toolia-gradient-dark': '#16203F',
        'toolia-gradient-light': '#2F3D6B',
        
        // Backgrounds
        'toolia-bg-main': '#0D1117',
        'toolia-bg-secondary': '#161D2D',
        'toolia-bg-section': '#1A2238',
        
        // Cards & Surfaces
        'toolia-card': '#1A2238',
        'toolia-card-hover': '#202E42',
        
        // Borders
        'toolia-border-subtle': '#2A3650',
        'toolia-border': '#384A66',
        
        // Text
        'toolia-text': '#F0F2F5',
        'toolia-text-secondary': '#8892A4',
        'toolia-text-muted': '#5A6B7F',
        
        // Status colors
        'toolia-success': '#10B981',
        'toolia-warning': '#F59E0B',
        'toolia-danger': '#EF4444',
        'toolia-info': '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
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
        'layout': '1200px',
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
        'soft': '0 4px 24px rgba(0,0,0,0.3)',
        'btn-primary': '0 10px 30px rgba(31,42,77,0.4)',
        'btn-hover': '0 12px 36px rgba(31,42,77,0.5)',
        'glow-primary': '0 0 20px rgba(31,42,77,0.3)',
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
