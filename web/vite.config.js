import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' để asset dùng đường dẫn tương đối → chạy đúng dù repo đặt ở
// https://<user>.github.io/<repo>/ mà không cần biết tên repo.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
})
