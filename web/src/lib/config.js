// Cấu hình runtime đọc từ biến môi trường Vite (build-time).
export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON)
// v11.1 — ĐÃ LOẠI BỎ DEMO khỏi bản triển khai:
//   • Đã cấu hình Supabase  → LUÔN chạy LIVE (đọc/ghi dữ liệu thật).
//   • Chưa cấu hình (.env trống) → 'demo' chỉ để XEM TRƯỚC cục bộ, không có cách bật demo trên web đã deploy.
export const DEFAULT_DATA_SOURCE = HAS_SUPABASE ? 'live' : 'demo'
