import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// base './' để asset dùng đường dẫn tương đối → chạy đúng dù repo đặt ở
// https://<user>.github.io/<repo>/ mà không cần biết tên repo.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Tách thư viện nặng thành chunk riêng:
    //  • Tải SONG SONG (nhanh hơn 1 cục lớn).
    //  • Khi deploy bản mới CHỈ phần code app đổi hash → recharts/react/... giữ
    //    nguyên trong cache trình duyệt → người dùng vào lại gần như tức thì.
    rollupOptions: {
      // 2 entry: dashboard đầy đủ (index) + trang thao tác từ email siêu nhẹ (action).
      // action.html KHÔNG import App/dashboard/charts → email deep-link vào đây chỉ tải
      // react+supabase+~10KB code thay vì cả app; bấm nhiều nút không lag.
      input: {
        main: resolve(__dirname, 'index.html'),
        action: resolve(__dirname, 'action.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('lucide-react')) return 'icons'
          // Recharts + phụ thuộc (d3…): KHÔNG ép chunk riêng. Chúng chỉ được
          // import động qua src/components/charts.jsx (React.lazy) → trả undefined
          // để Rollup tự gộp vào chunk ASYNC của module đó → KHÔNG tải ở màn hình
          // đầu, chỉ tải khi mở tab Xu hướng / modal phòng.
          if (
            id.includes('echarts') || id.includes('zrender') ||
            id.includes('recharts') || id.includes('victory-vendor') ||
            id.includes('d3-') || id.includes('internmap') ||
            id.includes('decimal.js') || id.includes('robust-predicates')
          ) return
          if (id.includes('@supabase') || id.includes('supabase')) return 'supabase'
          if (id.includes('react-dom') || id.includes('scheduler') || /[\\/]react[\\/]/.test(id)) return 'react'
          return 'vendor'
        },
      },
    },
  },
})
