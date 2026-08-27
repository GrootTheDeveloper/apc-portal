/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        'outline-variant': '#e1bfb8', 'tertiary-container': '#926100',
        'on-surface-variant': '#59413c', 'tertiary-fixed-dim': '#ffb94d',
        'surface-variant': '#e0e3e6', background: '#f7f9fc', 'on-tertiary': '#ffffff',
        'primary-fixed': '#ffdad3', 'on-secondary-fixed': '#001b3e', 'on-error': '#ffffff',
        'surface-dim': '#d8dadd', 'on-secondary-fixed-variant': '#00458e',
        'inverse-primary': '#ffb4a5', error: '#ba1a1a', 'tertiary-fixed': '#ffddb2',
        'secondary-container': '#5a9bff', 'surface-container-high': '#e6e8eb',
        'on-surface': '#191c1e', 'on-secondary-container': '#003269',
        'surface-bright': '#ffffff', 'surface-container-low': '#f5f7fa',
        'on-tertiary-fixed-variant': '#624000', 'surface-tint': '#b02e16', primary: '#a0220b',
        'on-tertiary-container': '#ffe9d1', 'on-secondary': '#ffffff',
        'surface-container-highest': '#e0e3e6', 'secondary-fixed': '#d6e3ff',
        'on-tertiary-fixed': '#291800', 'surface-container': '#f5f7fa',
        'inverse-on-surface': '#eff1f4', surface: '#ffffff', 'on-primary-fixed': '#3e0400',
        'surface-container-lowest': '#ffffff', 'error-container': '#ffdad6', tertiary: '#724b00',
        'inverse-surface': '#2d3133', 'on-error-container': '#93000a',
        'on-primary-container': '#ffe8e4', 'on-background': '#191c1e', 'on-primary': '#ffffff',
        'secondary-fixed-dim': '#aac7ff', 'primary-fixed-dim': '#ffb4a5', secondary: '#005db9',
        'primary-container': '#c23b22', outline: '#8d706b', 'on-primary-fixed-variant': '#8e1400',
        'apc-red': '#C23B22', 'apc-blue': '#1568C9', 'apc-gold': '#F0A202', 'apc-dark': '#081F3D',
      },
      borderRadius: { apc: '12px' },
      spacing: {
        'margin-mobile': '16px', 'container-max': '1520px', 'container-min': '1360px',
        gutter: '24px', 'section-padding': '80px', 'base-unit': '8px',
      },
      fontFamily: {
        'body-lg': ['Geist', 'sans-serif'], 'label-mono': ['Geist Mono', 'monospace'],
        'display-lg-mobile': ['Space Grotesk', 'sans-serif'], 'headline-md': ['Space Grotesk', 'sans-serif'],
        'body-md': ['Geist', 'sans-serif'], 'display-lg': ['Space Grotesk', 'sans-serif'],
        'headline-sm': ['Space Grotesk', 'sans-serif'], 'body-sm': ['Geist', 'sans-serif'],
        'nav-link': ['Geist', 'sans-serif'],
      },
      boxShadow: { 'apc-hover': '0 4px 12px rgba(8, 31, 61, 0.08)' },
    },
  },
  plugins: [],
}
