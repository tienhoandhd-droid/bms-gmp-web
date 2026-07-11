/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './action.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // WCAG AA (Mảng 4): `text-slate-400` mặc định (#94A3B8 ≈ 2.8:1) KHÔNG đạt
        // 4.5:1 cho chữ nhỏ. Ghi đè riêng bậc 400 sang #4A6072 (≈ 4.6:1 trên nền
        // trắng) — hệ chỉ dùng `text-slate-400` (88 chỗ), không dùng bg/border/ring
        // nên ghi đè an toàn: sửa 1 chỗ đạt chuẩn toàn bộ. Bậc slate khác giữ mặc định.
        slate: { 400: '#4A6072' },
      },
    },
  },
  plugins: [],
}
