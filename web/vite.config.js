import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('lucide-react')) return 'icons'
          if (
            id.includes('recharts') || id.includes('victory-vendor') ||
            id.includes('d3-') || id.includes('internmap') ||
            id.includes('decimal.js') || id.includes('robust-predicates')
          ) return 'charts'
          if (id.includes('@supabase') || id.includes('supabase')) return 'supabase'
          if (id.includes('react-dom') || id.includes('scheduler') || /[\\/]react[\\/]/.test(id)) return 'react'
          return 'vendor'
        },
      },
    },
  },
})
