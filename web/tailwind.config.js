/** @type {import('tailwindcss').Config} */
// G2 17/08/2026 — bảng màu SEMANTIC đọc từ src/theme/tokens.css (Light/Dark qua
// data-theme). Component dùng bg-surface/text-body/ring-line/text-success…;
// CẤM quay lại bg-white/text-slate-*/bg-teal-* (grep gate: scripts/kiem-mau.mjs).
const tk = (name) => `rgb(var(--rgb-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './action.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // WCAG AA (Mảng 4): ghi đè slate-400 (#4A6072 ≈ 4.6:1) — giữ cho code cũ
        // chưa quét; code mới dùng text-muted.
        slate: { 400: '#4A6072' },

        surface: tk('bg-surface'),
        subtle: tk('bg-subtle'),
        canvas: tk('bg-canvas'),
        anchorink: tk('anchor'),
        line: tk('border'),
        'line-strong': tk('border-strong'),
        strong: tk('text-strong'),
        body: tk('text-default'),
        muted: tk('text-muted'),
        inverse: tk('text-inverse'),
        focusring: tk('focus'),
        primarytk: { DEFAULT: tk('primary'), soft: tk('primary-soft'), solid: tk('primary-solid') },
        success: { DEFAULT: tk('success'), soft: tk('success-soft'), line: tk('success-line'), solid: tk('success-solid') },
        danger: { DEFAULT: tk('danger'), soft: tk('danger-soft'), line: tk('danger-line'), solid: tk('danger-solid') },
        warning: { DEFAULT: tk('warning'), soft: tk('warning-soft'), line: tk('warning-line'), solid: tk('warning-solid') },
        info: { DEFAULT: tk('info'), soft: tk('info-soft'), line: tk('info-line'), solid: tk('info-solid') },
      },
    },
  },
  plugins: [],
}
