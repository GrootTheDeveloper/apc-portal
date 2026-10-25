/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      // Bộ ba màu logo cùng nền, mực và các sắc độ phụ; khớp biến CSS trong src/index.css (DESIGN.md mục 2).
      colors: {
        'apc-red': '#C23B22', 'apc-red-deep': '#9A2A16', 'apc-red-pale': '#F6DED6',
        'apc-blue': '#1568C9', 'apc-blue-deep': '#0F52A0', 'apc-blue-pale': '#DCEAFB',
        'apc-gold': '#F0A202', 'apc-gold-deep': '#B87A00', 'apc-gold-soft': '#FFD36B', 'apc-gold-pale': '#FCEACA',
        paper: '#FFFFFF', canvas: '#FFFFFF', soft: '#F3F6FA', ink: '#081F3D', muted: '#4B5B73',
      },
      spacing: { 'container-max': '1520px', gutter: '24px' },
      // Baloo 2 cho tiêu đề (tròn, dày như chữ trong logo), Nunito cho chữ thường, JetBrains Mono cho code và comment.
      fontFamily: {
        display: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
        code: ['"JetBrains Mono"', 'Consolas', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
