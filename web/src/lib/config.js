// Cấu hình runtime đọc từ biến môi trường Vite (build-time).
export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
// Nguồn dữ liệu mặc định: 'demo' hoặc 'live'. Đổi được trong app.
export const DEFAULT_DATA_SOURCE =
  (import.meta.env.VITE_DATA_SOURCE === 'live' && SUPABASE_URL && SUPABASE_ANON) ? 'live' : 'demo'
export const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON)
